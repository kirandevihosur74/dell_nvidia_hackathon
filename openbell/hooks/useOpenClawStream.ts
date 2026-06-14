import { useEffect, useCallback, useRef, useMemo } from "react";
import { useGatewayStore } from "@/stores/gatewayStore";
import { useEncryptionStore } from "@/stores/encryptionStore";
import { gatewayClient, makeIdempotencyKey } from "@/services/gateway";
import { e2eService } from "@/services/encryption";
import { useChannelStore } from "@/stores/channelStore";
import { cacheOpenClawMessages, getCachedOpenClawMessages, mergeMessages, queueMessage, dequeueMessage } from "@/services/openclawOfflineService";
import { getProvider } from "@/services/gateway/providers/registry";
import type { GatewayMessage } from "@/types/gateway";
import type { OpenClawMessage, OpenClawToolCall, OpenClawMessageMeta } from "@/types/openclaw";
import { captureAndDescribe, describeFrame, buildVisionEnrichedMessage } from "@/services/openclaw/visionBridge";
import { safelyTakePhoto } from "@/services/streamio/cameraRef";
import { useStreamIOStreamStore } from "@/stores/streamio/streamStore";
import { useMeetingBotStore } from "@/stores/meetingBotStore";
import { sessionManager } from "@/services/gateway/sessionManager";
import { findAgent } from "@/services/openclaw/agentLookup";
import { parseDelegations, detectNaturalLanguageDelegation, relayToSubagent, shouldSuppressForRelay, clearRelaySession, setRelayStatus, cancelAllRelays } from "@/services/openclaw/subagentRelay";

/**
 * Strip context injections that were prepended to user messages before sending
 * to the gateway. When gateway history returns these messages, we want to show
 * only the user's original text in the chat bubble.
 */
function stripContextInjections(text: string): string {
  // Remove [User: ...] prefix
  text = text.replace(/^\[User: [^\]]+\]\n/, "");
  // Remove [SYSTEM INSTRUCTIONS ...] ... [END SYSTEM INSTRUCTIONS]\n---\n
  text = text.replace(/^\[SYSTEM INSTRUCTIONS —[^\]]*\][\s\S]*?\[END SYSTEM INSTRUCTIONS\]\n---\n/, "");
  // Remove [Subagents: ...] roster block
  text = text.replace(/^\[Subagents: \d+ available for delegation\]\n[\s\S]*?\n---\n/, "");
  // Remove [MEETING CONTEXT ...] block
  text = text.replace(/^\[MEETING CONTEXT —[^\]]*\]\n[\s\S]*?\n---\n/, "");
  // Remove [MEETING ENDED ...] block (post-meeting summary prompt sent by useMeetingBot)
  text = text.replace(/^\[MEETING ENDED —[^\]]*\]\n[\s\S]*?\n---\n/, "");
  return text.trim();
}

/** Deduplicate messages that have different IDs but identical role+content. */
function deduplicateByContent(messages: OpenClawMessage[]): OpenClawMessage[] {
  const seen = new Map<string, OpenClawMessage>();
  for (const m of messages) {
    const key = `${m.role}:${m.sessionId}:${m.content.slice(0, 200)}`;
    const existing = seen.get(key);
    if (existing) {
      // Keep the one with more metadata or the newer one
      if ((m.meta && !existing.meta) || m.timestamp > existing.timestamp) {
        seen.set(key, m);
      }
    } else {
      seen.set(key, m);
    }
  }
  // Preserve original ordering
  const kept = new Set(Array.from(seen.values()).map((m) => m.id));
  return messages.filter((m) => kept.has(m.id));
}

/**
 * Hook for managing OpenClaw chat streaming.
 * Handles message assembly from the Gateway's event protocol:
 * - { event: "chat", payload: { state: "delta", message } } → streaming token
 * - { event: "chat", payload: { state: "final", message } } → done
 * - { event: "chat", payload: { state: "error", errorMessage } } → error
 * - { event: "agent", payload: { ... tool data ... } } → tool calls
 */
export function useOpenClawStream() {
  const {
    activeGatewayId,
    activeSessionId,
    activeProfileId,
    profiles,
    connectionStatus,
    messages,
    streamingContent,
    isStreaming,
    addMessage,
    updateMessageStatus,
    setMessages,
    setStreamingContent,
    appendStreamingContent,
    setIsStreaming,
  } = useGatewayStore();

  const { activeChannelId } = useChannelStore();
  const { enabled: encryptionEnabled } = useEncryptionStore();

  // Resolve provider based on the active gateway's config
  const gateways = useGatewayStore((s) => s.gateways);
  const provider = useMemo(() => {
    const gw = gateways.find((g) => g.id === activeGatewayId);
    return getProvider(gw?.providerType || "openclaw");
  }, [gateways, activeGatewayId]);

  // Track channelId and encryption via refs to avoid effect teardown
  const channelIdRef = useRef(activeChannelId);
  channelIdRef.current = activeChannelId;
  const encryptionRef = useRef(encryptionEnabled);
  encryptionRef.current = encryptionEnabled;

  // Sync e2eService enabled state with store
  useEffect(() => {
    if (encryptionEnabled && activeGatewayId) {
      e2eService.enable(activeGatewayId);
    } else {
      e2eService.disable();
    }
  }, [encryptionEnabled, activeGatewayId]);

  const streamingRef = useRef<{
    content: string;
    toolCalls: OpenClawToolCall[];
    runId: string | null;
    isStreaming: boolean;
    threadId: string | undefined;
  }>({ content: "", toolCalls: [], runId: null, isStreaming: false, threadId: undefined });

  // Reset streaming state when switching gateways
  useEffect(() => {
    streamingRef.current = { content: "", toolCalls: [], runId: null, isStreaming: false, threadId: undefined };
    setStreamingContent("");
    setIsStreaming(false);
    cancelAllRelays();
  }, [activeGatewayId]);

  // Track tool calls that look like gateway-side delegation (toolCallId → agent label)
  const delegationToolCalls = useRef<Map<string, string>>(new Map());

  // Prevent re-triggering delegation for the same agent within a cooldown window
  const recentDelegations = useRef<Map<string, number>>(new Map());
  const DELEGATION_COOLDOWN_MS = 60000; // 60s cooldown per agent

  // Safety valve: auto-reset isStreaming if no gateway events arrive for 60s.
  // Prevents the input from getting permanently locked after relay failures.
  const streamingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetStreamingTimeout = useCallback(() => {
    if (streamingTimeoutRef.current) clearTimeout(streamingTimeoutRef.current);
    streamingTimeoutRef.current = setTimeout(() => {
      if (streamingRef.current.isStreaming) {
        streamingRef.current = { content: "", toolCalls: [], runId: null, isStreaming: false, threadId: undefined };
        setStreamingContent("");
        setIsStreaming(false);
      }
    }, 60000);
  }, [setIsStreaming, setStreamingContent]);

  /** Detect if a tool call is a gateway-side delegation to a subagent.
   *  Returns the agent display name if detected, null otherwise. */
  const detectDelegationToolCall = useCallback((
    toolName: string,
    args: Record<string, unknown> | undefined,
  ): string | null => {
    const nameLower = toolName.toLowerCase();

    // Match tool names that suggest delegation
    const delegationToolPatterns = [
      "delegate", "relay", "consult", "ask_agent", "send_to_agent",
      "subagent", "forward", "dispatch", "route_to",
    ];
    const isDelegationTool = delegationToolPatterns.some(p => nameLower.includes(p));

    // Also check if args reference a known subagent session
    const allSessions = sessionManager.getSessions();
    const subagentSessions = allSessions.filter(s => s.agentId && s.id !== (activeSessionId || "main"));

    if (isDelegationTool && args) {
      // Try to extract agent name from args
      const agentRef = (args.agent || args.agentId || args.agent_id || args.target || args.session || args.to) as string | undefined;
      if (agentRef) {
        const match = subagentSessions.find(s =>
          s.agentId === agentRef || s.name.toLowerCase() === agentRef.toLowerCase() || s.id === agentRef
        );
        return match?.name || agentRef;
      }
      return toolName; // Show the tool name if we can't resolve the agent
    }

    // Fallback: check if args contain a known agent name/id even for generic tool names
    // (e.g., a "chat.send" tool with a sessionKey targeting a subagent)
    if (args) {
      const sessionKey = (args.sessionKey || args.session_key || args.sessionId || args.session_id) as string | undefined;
      if (sessionKey) {
        const match = subagentSessions.find(s => s.id === sessionKey || sessionKey.includes(s.id));
        if (match) return match.name;
      }

      // Check if any string arg value matches a subagent name/id
      const argValues = Object.values(args).filter(v => typeof v === "string") as string[];
      for (const val of argValues) {
        const valLower = val.toLowerCase();
        const match = subagentSessions.find(s =>
          s.agentId?.toLowerCase() === valLower ||
          s.name.toLowerCase() === valLower ||
          s.id === val
        );
        if (match) return match.name;
      }
    }

    return null;
  }, [activeSessionId]);

  // Intercept meeting.* tool calls from agents
  const handleMeetingToolCall = useCallback((toolName: string, args: Record<string, unknown> | undefined) => {
    if (!args) return;
    const botStore = useMeetingBotStore.getState();
    if (botStore.status !== "recording") return;

    switch (toolName) {
      case "meeting.createActionItem":
        botStore.addActionItem({
          id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          description: (args.description as string) || "",
          owner: (args.owner as string) || null,
          deadline: (args.deadline as string) || null,
          status: "detected",
          nerveTaskId: null,
          boardTaskId: null,
          sourceAgentId: "",
          detectedAt: new Date().toISOString(),
          confirmedAt: null,
        });
        break;

      case "meeting.flagRisk":
        // Surface as an action item with risk prefix for visibility
        botStore.addActionItem({
          id: `risk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          description: `[${(args.severity as string || "medium").toUpperCase()} RISK] ${(args.riskType as string) || ""}: ${(args.description as string) || ""}`,
          owner: null,
          deadline: null,
          status: "detected",
          nerveTaskId: null,
          boardTaskId: null,
          sourceAgentId: "",
          detectedAt: new Date().toISOString(),
          confirmedAt: null,
        });
        break;

      case "meeting.addNote":
        // Add as a transcript annotation
        botStore.addTranscriptLine({
          speaker: "Agent Note",
          text: (args.content as string) || "",
          timestamp: new Date().toISOString(),
        });
        break;

      case "meeting.sendFollowUp":
        // Queue as a draft action item the user can review
        botStore.addActionItem({
          id: `fu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          description: `Follow-up to ${(args.recipient as string) || "?"}: ${(args.subject as string) || ""}`,
          owner: (args.recipient as string) || null,
          deadline: null,
          status: "detected",
          nerveTaskId: null,
          boardTaskId: null,
          sourceAgentId: "",
          detectedAt: new Date().toISOString(),
          confirmedAt: null,
        });
        break;
    }
  }, []);

  // Regex for gateway subagent session keys
  // Matches both agent:main:subagent:<id> and webchat:g-agent-main-subagent-<id>
  const SUBAGENT_KEY_RE = /subagent[:\-]/;

  // Handle incoming streaming messages
  useEffect(() => {
    const unsub = gatewayClient.onMessage((msg: GatewayMessage) => {
      // Detect gateway-side subagent delegation and show banner
      const msgSessionKey = msg.payload?.sessionKey as string | undefined;
      if (msgSessionKey && SUBAGENT_KEY_RE.test(msgSessionKey)) {
        // Resolve display name: gateway lookup → local session match → truncated key
        let agentLabel = sessionManager.getGatewaySubagentName(msgSessionKey);
        if (!agentLabel) {
          // Try matching the session key against local client-side sessions
          const localSessions = sessionManager.getSessions();
          const localMatch = localSessions.find(s =>
            s.agentId && (msgSessionKey.includes(s.agentId) || msgSessionKey.includes(s.id))
          );
          agentLabel = localMatch?.name || msgSessionKey.split(":").pop()?.slice(0, 8) || "subagent";
        }

        if (msg.type === "chat_token") {
          setRelayStatus("streaming", agentLabel);
        } else if (msg.type === "chat_done") {
          setRelayStatus("done", agentLabel);
          setTimeout(() => setRelayStatus("idle", agentLabel), 5000);

          // Store the subagent's response only when the user is NOT on that tab.
          // If they are, the regular chat_done handler below will store it (avoiding duplicates).
          if (!activeSessionId || msgSessionKey !== activeSessionId) {
            const subPayload = msg.payload;
            const subText = provider.extractText(subPayload?.message);
            if (subText) {
              addMessage({
                id: `gwsub_${Date.now()}_${msgSessionKey.slice(-6)}`,
                sessionId: msgSessionKey,
                gatewayId: activeGatewayId || "",
                role: "assistant",
                content: subText,
                timestamp: new Date().toISOString(),
                status: "delivered",
                meta: { source: `subagent:${agentLabel}` },
              });
            }
          }
        } else if (msg.type === "chat_error") {
          setRelayStatus("error", agentLabel);
          setTimeout(() => setRelayStatus("idle", agentLabel), 5000);
        }

        // Don't process subagent events in the main chat stream —
        // they're stored above and visible when the user switches to that tab
        if (activeSessionId && msgSessionKey !== activeSessionId) return;
      }

      // Suppress events that belong to an active client-side relay
      if (shouldSuppressForRelay(msg)) return;

      switch (msg.type) {
        case "chat_token": {
          // Delta: payload has { state: "delta", message: { content: [...] }, runId, sessionKey }
          const payload = msg.payload;
          const text = provider.extractText(payload?.message);
          if (text) {
            // The Gateway sends cumulative text, not incremental tokens
            const prev = streamingRef.current.content;
            if (text.length > prev.length) {
              const delta = text.slice(prev.length);
              streamingRef.current.content = text;
              appendStreamingContent(delta);
            }
          }
          if (payload?.runId) {
            streamingRef.current.runId = payload.runId as string;
          }
          if (!streamingRef.current.isStreaming) {
            streamingRef.current.isStreaming = true;
            setIsStreaming(true);
          }
          resetStreamingTimeout();
          break;
        }

        case "chat_tool_call": {
          // Agent tool call event
          const payload = msg.payload;
          const toolCallId = (payload?.toolCallId as string) || `tc_${Date.now()}`;
          const name = (payload?.name as string) || (payload?.toolName as string) || "";

          // Check if we already have this tool call (update) or it's new (insert)
          const existing = streamingRef.current.toolCalls.find((t) => t.id === toolCallId);
          if (existing) {
            // Update: might have output/result now
            if (payload?.output !== undefined) {
              existing.status = "completed";
              existing.output = payload.output;
              existing.completedAt = new Date().toISOString();

              // If this was a delegation tool call, update banner to "done"
              if (delegationToolCalls.current.has(toolCallId)) {
                const agentLabel = delegationToolCalls.current.get(toolCallId)!;
                setRelayStatus("done", agentLabel);
                setTimeout(() => setRelayStatus("idle", agentLabel), 5000);
                delegationToolCalls.current.delete(toolCallId);
              }
            }
            if (payload?.args !== undefined) {
              existing.input = payload.args as Record<string, unknown>;
            }
          } else {
            const toolCall: OpenClawToolCall = {
              id: toolCallId,
              toolName: name,
              status: "running",
              input: payload?.args as Record<string, unknown>,
              startedAt: new Date().toISOString(),
            };
            streamingRef.current.toolCalls.push(toolCall);

            // Detect gateway-side delegation tool calls and show the relay banner.
            // The gateway agent may delegate via tool use instead of [DELEGATE:] tags.
            const detectedAgent = detectDelegationToolCall(name, payload?.args as Record<string, unknown>);
            if (detectedAgent) {
              delegationToolCalls.current.set(toolCallId, detectedAgent);
              setRelayStatus("sending", detectedAgent);
            }
          }
          // Intercept meeting.* tool calls for meeting bot integration
          if (name.startsWith("meeting.")) {
            handleMeetingToolCall(name, payload?.args as Record<string, unknown>);
          }

          if (!streamingRef.current.isStreaming) {
            streamingRef.current.isStreaming = true;
            setIsStreaming(true);
          }
          break;
        }

        case "chat_done": {

          // Final: payload has { state: "final", message: { role, content: [...] } }
          const payload = msg.payload;
          const finalText = provider.extractText(payload?.message) || streamingRef.current.content;

          // Use activeSessionId as authoritative — the gateway may return an
          // expanded key (e.g. "agent:main:main") that doesn't match our filter.
          const assistantMsg: OpenClawMessage = {
            id: streamingRef.current.runId ? `ast_${streamingRef.current.runId}` : `msg_${Date.now()}`,
            sessionId: activeSessionId || (payload?.sessionKey as string) || "",
            gatewayId: activeGatewayId || "",
            profileId: activeProfileId || undefined,
            channelId: channelIdRef.current || undefined,
            threadId: streamingRef.current.threadId,
            role: "assistant",
            content: finalText,
            timestamp: new Date().toISOString(),
            status: "delivered",
            toolCalls:
              streamingRef.current.toolCalls.length > 0
                ? [...streamingRef.current.toolCalls]
                : undefined,
          };

          // Extract usage metadata — try multiple possible locations/field names
          const usage = (payload?.usage || payload?.stats || payload?.metrics) as Record<string, unknown> | undefined;
          const msgObj = payload?.message as Record<string, unknown> | undefined;
          const msgUsage = msgObj?.usage as Record<string, unknown> | undefined;
          const u = usage || msgUsage;
          const model = (payload?.model || msgObj?.model || payload?.modelId) as string | undefined;

          if (u || model) {
            assistantMsg.meta = {
              model,
              inputTokens: (u?.inputTokens ?? u?.input_tokens ?? u?.promptTokens ?? u?.prompt_tokens) as number | undefined,
              outputTokens: (u?.outputTokens ?? u?.output_tokens ?? u?.completionTokens ?? u?.completion_tokens) as number | undefined,
              cacheRead: (u?.cacheReadInputTokens ?? u?.cache_read_input_tokens ?? u?.cacheRead) as number | undefined,
              cacheWrite: (u?.cacheCreationInputTokens ?? u?.cache_creation_input_tokens ?? u?.cacheWrite) as number | undefined,
              contextPercent: (u?.contextPercent ?? u?.context_percent ?? u?.ctxPercent) as number | undefined,
              source: (payload?.source || payload?.channel) as string | undefined,
            };
          }

          // Guard against duplicate responses (e.g. from backlogged gateway requests)
          const recent = useGatewayStore.getState().messages;
          const isDupe = recent.some(
            (m) => m.role === "assistant" && m.sessionId === assistantMsg.sessionId &&
              m.content === assistantMsg.content && (Date.now() - new Date(m.timestamp).getTime()) < 10000
          );
          if (!isDupe) {
            addMessage(assistantMsg);
          }

          // Engage spawned subagent sessions — only from the main session,
          // and only when the agent explicitly delegates via [DELEGATE:] tags.
          const currentSession = sessionManager.getSession(activeSessionId || "main");
          if (!currentSession?.agentId) {
            // Only honor explicit [DELEGATE:] tags in the assistant response
            let delegations = parseDelegations(finalText);

            // Dedup: skip agents already delegated recently
            const now = Date.now();
            delegations = delegations.filter(d => {
              const lastTime = recentDelegations.current.get(d.agentId);
              return !lastTime || (now - lastTime) > DELEGATION_COOLDOWN_MS;
            });

            if (delegations.length > 0) {
              for (const d of delegations) {
                recentDelegations.current.set(d.agentId, now);
              }

              // Show banner immediately
              for (const d of delegations) {
                const agent = sessionManager.getSessions().find(s => s.agentId === d.agentId);
                setRelayStatus("sending", agent?.name || d.agentId);
              }

              // Relay sequentially, show each response as a follow-up message
              (async () => {
                for (let i = 0; i < delegations.length; i++) {
                  if (i > 0) await new Promise(r => setTimeout(r, 3000));
                  const result = await relayToSubagent(delegations[i].agentId, delegations[i].task);
                  clearRelaySession(result.sessionId);

                  if (result.success) {
                    setRelayStatus("done", result.agentName);
                    addMessage({
                      id: `sub_${result.agentId}_${Date.now()}`,
                      sessionId: activeSessionId || "main",
                      gatewayId: activeGatewayId || "",
                      channelId: channelIdRef.current || undefined,
                      role: "assistant",
                      content: result.response,
                      timestamp: new Date().toISOString(),
                      status: "delivered",
                      meta: { source: `subagent:${result.agentName}` },
                    });
                  } else {
                    setRelayStatus("error", result.agentName);
                  }
                  setTimeout(() => setRelayStatus("idle", result.agentName), 5000);
                }
              })();
            }
          }

          // Mark any remaining delegation tool calls as done (gateway may not send
          // individual completion events for each tool call)
          for (const [tcId, agentLabel] of delegationToolCalls.current) {
            setRelayStatus("done", agentLabel);
            setTimeout(() => setRelayStatus("idle", agentLabel), 5000);
            delegationToolCalls.current.delete(tcId);
          }

          // Reset streaming state
          if (streamingTimeoutRef.current) clearTimeout(streamingTimeoutRef.current);
          streamingRef.current = { content: "", toolCalls: [], runId: null, isStreaming: false, threadId: undefined };
          setStreamingContent("");
          setIsStreaming(false);
          break;
        }

        case "chat_error": {
          const payload = msg.payload;
          const errorMsg: OpenClawMessage = {
            id: `err_${Date.now()}`,
            sessionId: activeSessionId || (payload?.sessionKey as string) || "",
            gatewayId: activeGatewayId || "",
            profileId: activeProfileId || undefined,
            channelId: channelIdRef.current || undefined,
            threadId: streamingRef.current.threadId,
            role: "assistant",
            content: `Error: ${(payload?.errorMessage as string) || (payload?.message as string) || "Unknown error"}`,
            timestamp: new Date().toISOString(),
            status: "error",
          };
          addMessage(errorMsg);

          streamingRef.current = { content: "", toolCalls: [], runId: null, isStreaming: false, threadId: undefined };
          setStreamingContent("");
          setIsStreaming(false);
          break;
        }
      }
    });

    return unsub;
  }, [provider, activeGatewayId, activeSessionId, addMessage, appendStreamingContent, setIsStreaming, setStreamingContent]);

  // Load chat history: local cache first (preserves channelId), then merge gateway history
  const historyFetchedRef = useRef<string | null>(null);
  useEffect(() => {
    if (connectionStatus !== "connected" || !activeGatewayId) return;

    const sessionKey = activeSessionId || "main";
    const fetchKey = `${activeGatewayId}:${sessionKey}`;

    // Only fetch once per gateway+session
    if (historyFetchedRef.current === fetchKey) return;
    historyFetchedRef.current = fetchKey;

    const loadHistory = async () => {
      // 1. Load local cache first (has channelId preserved)
      const cached = await getCachedOpenClawMessages(sessionKey, activeGatewayId);

      // 2. Fetch gateway history for any new messages
      let gatewayMessages: OpenClawMessage[] = [];
      try {
        const historyReq = provider.buildChatHistory(sessionKey);
        const result = await gatewayClient.request(historyReq.method, historyReq.params) as Record<string, unknown> | undefined;

        const historyMessages = (result?.messages || result?.history) as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(historyMessages)) {
          for (let i = 0; i < historyMessages.length; i++) {
            const m = historyMessages[i];
            const role = m.role as string;
            let text = provider.extractText(m) || (typeof m.content === "string" ? m.content as string : "");
            if (!text) continue;

            // Strip context injections that were prepended before sending to gateway
            // so user bubbles show the original message, not the full context block.
            // If the entire message was a system-generated prompt (e.g. post-meeting
            // summary request), stripping leaves it empty — skip it entirely.
            if (role === "user") {
              text = stripContextInjections(text);
              if (!text) continue;
            }

            const usage = m.usage as Record<string, unknown> | undefined;
            const model = m.model as string | undefined;
            let meta: OpenClawMessageMeta | undefined;
            if (usage || model) {
              meta = {
                model,
                inputTokens: (usage?.inputTokens ?? usage?.input_tokens) as number | undefined,
                outputTokens: (usage?.outputTokens ?? usage?.output_tokens) as number | undefined,
                cacheRead: (usage?.cacheReadInputTokens ?? usage?.cache_read_input_tokens ?? usage?.cacheRead) as number | undefined,
                cacheWrite: (usage?.cacheCreationInputTokens ?? usage?.cache_creation_input_tokens ?? usage?.cacheWrite) as number | undefined,
                contextPercent: (usage?.contextPercent ?? usage?.context_percent) as number | undefined,
              };
            }

            gatewayMessages.push({
              id: (m.id as string) || (role === "user" ? `hist_usr_${i}` : `hist_ast_${i}`),
              sessionId: sessionKey,
              gatewayId: activeGatewayId,
              role: (role === "user" ? "user" : "assistant") as OpenClawMessage["role"],
              content: text,
              timestamp: (m.timestamp as string) || (m.createdAt as string) || new Date().toISOString(),
              status: "delivered",
              meta,
            });
          }
        }
      } catch {
        // chat.history may not be supported — ignore
      }

      // 3. Use local cache as base (preserves channelId), merge any new gateway messages
      if (cached.length > 0) {
        // Enrich cached messages with metadata from gateway history.
        // Gateway history has usage/model data but no channelId;
        // cached messages have channelId but may lack metadata.
        if (gatewayMessages.length > 0) {
          // Build a lookup of gateway messages by content+role for fuzzy matching
          const gwByContent = new Map<string, OpenClawMessage>();
          for (const gm of gatewayMessages) {
            gwByContent.set(`${gm.role}:${gm.content.slice(0, 100)}`, gm);
          }

          for (const cm of cached) {
            if (!cm.meta && cm.role === "assistant") {
              const key = `${cm.role}:${cm.content.slice(0, 100)}`;
              const match = gwByContent.get(key);
              if (match?.meta) {
                cm.meta = match.meta;
              }
            }
          }
        }

        const { merged } = mergeMessages(cached, gatewayMessages);
        // Deduplicate by content+role+timestamp proximity to avoid duplicates
        // from streaming (ast_*) vs cache (usr_*/hist_*) ID mismatches
        setMessages((prev: OpenClawMessage[]) => {
          const otherGateway = prev.filter((m: OpenClawMessage) => m.gatewayId !== activeGatewayId);
          return [...otherGateway, ...deduplicateByContent(merged)];
        });
      } else if (gatewayMessages.length > 0) {
        setMessages((prev: OpenClawMessage[]) => {
          const otherGateway = prev.filter((m: OpenClawMessage) => m.gatewayId !== activeGatewayId);
          return [...otherGateway, ...deduplicateByContent(gatewayMessages)];
        });
      }
    };

    loadHistory();
  }, [connectionStatus, activeGatewayId, activeSessionId, setMessages]);

  // Persist messages whenever they change
  useEffect(() => {
    if (activeSessionId && activeGatewayId && messages.length > 0) {
      const sessionMessages = messages.filter(
        (m) => m.sessionId === activeSessionId && m.gatewayId === activeGatewayId
      );
      if (sessionMessages.length > 0) {
        cacheOpenClawMessages(activeSessionId, sessionMessages, activeGatewayId);
      }
    }
  }, [messages, activeSessionId, activeGatewayId]);

  // Send a message using the Gateway's req/res protocol.
  // When the live stream is active, uses a two-stage vision pipeline:
  //   Stage 1: Auto-capture frame → StreamIO inference (Gemini) → visual description
  //   Stage 2: Visual context + question → OpenClaw gateway (Claude) → reasoning + tool use
  const send = useCallback(
    async (text: string, imageData?: string, threadId?: string) => {
      if (!activeGatewayId) return;

      const sessionKey = activeSessionId || "main";
      const isStreamLive = useStreamIOStreamStore.getState().status === "streaming";

      const userMsg: OpenClawMessage = {
        id: `usr_${Date.now()}`,
        sessionId: sessionKey,
        gatewayId: activeGatewayId,
        profileId: activeProfileId || undefined,
        channelId: channelIdRef.current || undefined,
        threadId,
        role: "user",
        content: text,
        imageData: imageData || (isStreamLive ? "auto" : undefined),
        timestamp: new Date().toISOString(),
        status: "sending",
      };

      addMessage(userMsg);

      // Cancel any stuck relays from previous cycles — user is moving on
      cancelAllRelays();
      recentDelegations.current.clear();

      if (connectionStatus !== "connected") {
        updateMessageStatus(userMsg.id, "queued");
        await queueMessage(userMsg);
        return;
      }

      try {
        let frameBase64: string | null = null;

        // Auto-capture a frame when the stream is live
        if (isStreamLive && !imageData) {
          try {
            frameBase64 = await Promise.race([
              safelyTakePhoto(),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
            ]);
          } catch {
            // Frame capture failed — continue with text only
          }
        }

        const attachedImage = imageData || frameBase64 || undefined;

        // Try sending directly through the gateway with image content blocks
        // (requires tools.media.image enabled on the gateway)
        // Track thread context for the streaming response
        streamingRef.current.threadId = threadId;

        // Build message with context injections.
        // Order (top → bottom): system prompt, subagent roster, meeting context, user text.
        // Meeting context is placed closest to the user's message so the LLM
        // treats it as immediate context rather than preamble.
        let messageText = text;

        // 1. Meeting context — prepend directly above the user's message (main session only)
        const isMainSession = !sessionManager.getSession(sessionKey)?.agentId;
        const botState = useMeetingBotStore.getState();
        console.log(`[OpenClawStream] Meeting context check: status=${botState.status}, routingMode=${botState.routingMode}, transcriptLines=${botState.transcriptLines.length}, botId=${botState.botId}, isMainSession=${isMainSession}`);
        if (
          isMainSession &&
          botState.status === "recording" &&
          (botState.routingMode === "gateway" || botState.routingMode === "both") &&
          botState.transcriptLines.length > 0
        ) {
          console.log(`[OpenClawStream] Injecting meeting context (${botState.transcriptLines.length} lines)`);
          const transcriptBlock = botState.transcriptLines
            .map((l) => `[${l.timestamp?.slice(11, 19) || ""}] ${l.speaker}: ${l.text}`)
            .join("\n");
          const platform = botState.platform || "unknown";
          const pending = botState.actionItems.filter((a) => a.status === "detected").length;
          messageText = `[MEETING CONTEXT — Live from ${platform} meeting]\nTranscript (last ${botState.transcriptLines.length} lines):\n${transcriptBlock}\n[Action items pending: ${pending}]\n---\n${text}`;
        }

        // 2. Subagent roster — only inject on the main session, and only when
        //    the user's message mentions delegation or an agent name (keeps messages lean)
        const allSessions = sessionManager.getSessions();
        const subagentSessions = allSessions.filter(s => s.agentId && s.id !== sessionKey);
        if (subagentSessions.length > 0 && isMainSession) {
          const textLower = text.toLowerCase();
          const mentionsAgent = subagentSessions.some(s =>
            textLower.includes(s.name.toLowerCase()) ||
            textLower.includes(s.agentId?.toLowerCase() || "")
          );
          const mentionsDelegation = /\b(delegate|ask|consult|check with|forward|send to|have .+ look)\b/i.test(text);
          if (mentionsAgent || mentionsDelegation) {
            const roster = subagentSessions.map(s => `- ${s.name} (${s.agentId || s.id})`).join("\n");
            messageText = `[Subagents: ${subagentSessions.length} available for delegation]\n${roster}\n---\n${messageText}`;
          }
        }

        // 3. Subagent system prompt — prepend at very top
        const activeSession = sessionManager.getSession(sessionKey);
        if (activeSession?.systemPrompt && !activeSession.systemPromptSent) {
          messageText = `[SYSTEM INSTRUCTIONS — Subagent: ${activeSession.name}]\n${activeSession.systemPrompt}\n[END SYSTEM INSTRUCTIONS]\n---\n${messageText}`;
          sessionManager.markSystemPromptSent(sessionKey);
        }

        // Include profile context inline in the message text (not as a protocol field,
        // which can cause gateways that don't support it to hang)
        const activeProfile = profiles.find((p) => p.id === activeProfileId);
        if (activeProfile && activeProfile.id !== "default" && isMainSession) {
          messageText = `[User: ${activeProfile.displayName}]\n${messageText}`;
        }

        console.log(`[OpenClawStream] Sending to gateway: sessionKey=${sessionKey}, profileId=${activeProfileId}, messageLength=${messageText.length}, hasMeetingContext=${messageText.includes("[MEETING CONTEXT")}, preview="${messageText.slice(0, 150)}..."`);
        const chatReq = provider.buildChatSend(sessionKey, messageText, makeIdempotencyKey(userMsg.id), attachedImage);
        const result = await gatewayClient.request(chatReq.method, chatReq.params) as Record<string, unknown> | undefined;

        if (result?.runId) {
          streamingRef.current.runId = result.runId as string;
        }

        updateMessageStatus(userMsg.id, "sent");
      } catch (err) {
        // If direct gateway send failed and we had an image, fall back to Gemini vision bridge
        if (imageData || isStreamLive) {
          try {
            let vision: { description: string; success: boolean };
            if (imageData) {
              vision = await describeFrame(imageData, text);
            } else {
              vision = await captureAndDescribe(text);
            }

            if (vision.success && vision.description) {
              const enriched = buildVisionEnrichedMessage(text, vision.description);
              const fallbackReq = provider.buildChatSend(sessionKey, enriched, makeIdempotencyKey(userMsg.id));
              const fallbackResult = await gatewayClient.request(fallbackReq.method, fallbackReq.params) as Record<string, unknown> | undefined;
              if (fallbackResult?.runId) {
                streamingRef.current.runId = fallbackResult.runId as string;
              }
              updateMessageStatus(userMsg.id, "sent");
              return;
            }
          } catch {
            // Fallback also failed
          }
        }

        // Retry with backoff instead of silently queuing
        const retryDelays = [5000, 10000, 20000];
        let sent = false;
        for (const retryDelay of retryDelays) {
          await new Promise(r => setTimeout(r, retryDelay));
          if (connectionStatus !== "connected") break;
          try {
            const retryReq = provider.buildChatSend(sessionKey, messageText, makeIdempotencyKey(`${userMsg.id}_retry`));
            const retryResult = await gatewayClient.request(retryReq.method, retryReq.params) as Record<string, unknown> | undefined;
            if (retryResult?.runId) {
              streamingRef.current.runId = retryResult.runId as string;
            }
            updateMessageStatus(userMsg.id, "sent");
            sent = true;
            break;
          } catch {
            // Next retry
          }
        }
        if (!sent) {
          updateMessageStatus(userMsg.id, "queued");
          await queueMessage(userMsg);
        }
      }
    },
    [activeSessionId, activeGatewayId, connectionStatus, addMessage, updateMessageStatus]
  );

  // Flush queued messages when reconnected
  useEffect(() => {
    if (connectionStatus !== "connected" || !activeGatewayId) return;

    const sessionKey = activeSessionId || "main";

    const flushQueue = async () => {
      const { getMessageQueue } = await import("@/services/openclawOfflineService");
      const queue = await getMessageQueue();
      for (const msg of queue) {
        try {
          const flushReq = provider.buildChatSend(sessionKey, msg.content, makeIdempotencyKey(msg.id));
          await gatewayClient.request(flushReq.method, flushReq.params);
          updateMessageStatus(msg.id, "sent");
          await dequeueMessage(msg.id);
        } catch {
          // Leave in queue for next attempt
        }
      }
    };

    flushQueue();
  }, [connectionStatus, activeSessionId, activeGatewayId, updateMessageStatus]);

  return {
    messages,
    streamingContent,
    isStreaming,
    send,
    activeToolCalls: streamingRef.current.toolCalls.filter((tc) => tc.status === "running"),
  };
}
