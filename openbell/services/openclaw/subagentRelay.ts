/**
 * Subagent Relay — sends a message to a subagent session and collects the full response.
 *
 * Listens to gateway message events for streaming tokens on the target session,
 * accumulates the response, and resolves when chat_done fires.
 */
import { gatewayClient, makeIdempotencyKey } from "@/services/gateway";
import { getProvider } from "@/services/gateway/providers/registry";
import { sessionManager } from "@/services/gateway/sessionManager";
import { useGatewayStore } from "@/stores/gatewayStore";
import type { GatewayMessage } from "@/types/gateway";

export interface RelayResult {
  agentId: string;
  agentName: string;
  sessionId: string;
  response: string;
  success: boolean;
  error?: string;
}

export type RelayStatus = "idle" | "sending" | "streaming" | "relaying" | "done" | "error";

export interface RelayAgentStatus {
  agentName: string;
  status: RelayStatus;
}

// Per-agent status map
const agentStatuses = new Map<string, RelayAgentStatus>();

type RelayStatusHandler = (statuses: Map<string, RelayAgentStatus>) => void;

const statusHandlers = new Set<RelayStatusHandler>();

export function onRelayStatus(handler: RelayStatusHandler): () => void {
  statusHandlers.add(handler);
  return () => statusHandlers.delete(handler);
}

function notifyAll() {
  for (const handler of statusHandlers) {
    try { handler(new Map(agentStatuses)); } catch { /* ignore */ }
  }
}

function notifyStatus(status: RelayStatus, agentName: string) {
  const key = agentName.replace(/ back to Main$/, "");
  if (status === "idle") {
    agentStatuses.delete(key);
  } else {
    agentStatuses.set(key, { agentName, status });
  }
  notifyAll();
}

/** Notify relay status from outside the relay (e.g. during response injection). */
export function setRelayStatus(status: RelayStatus, agentName: string): void {
  notifyStatus(status, agentName);
}

/** Cancel all active relays and clear statuses — call when a new chat cycle starts
 *  to dismiss stale banners and stop suppressing events from stuck relays. */
export function cancelAllRelays(): void {
  agentStatuses.clear();
  activeRelaySessions.clear();
  activeRelayRunIds.clear();
  notifyAll();
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Track active relay sessions so the main stream handler can ignore their events
const activeRelaySessions = new Set<string>();
const activeRelayRunIds = new Set<string>();

/** Returns true if a relay is currently in progress. */
export function isRelayActive(): boolean {
  return activeRelaySessions.size > 0;
}

/** Call when the full relay cycle (send + response injection) is complete. */
export function clearRelaySession(sessionId: string): void {
  activeRelaySessions.delete(sessionId);
  activeRelayRunIds.clear();
}

/** Returns true if this event belongs to an active relay and should be suppressed.
 *  Only suppresses events that match a relay session — never suppresses main session events. */
export function shouldSuppressForRelay(msg: GatewayMessage): boolean {
  if (activeRelaySessions.size === 0) return false;

  const sessionKey = msg.payload?.sessionKey as string | undefined;
  const runId = msg.payload?.runId as string | undefined;

  // Suppress if the runId matches a known relay run
  if (runId && activeRelayRunIds.has(runId)) return true;

  // Suppress if the sessionKey matches a known relay session (exact or expanded)
  if (sessionKey) {
    for (const relaySession of activeRelaySessions) {
      if (sessionKey === relaySession || sessionKey.includes(relaySession)) return true;
    }
  }

  return false;
}

/** Parse [DELEGATE:agent-id] blocks from assistant text. Returns all delegation requests found.
 *  Captures everything after the tag until the next [DELEGATE:] or end of text,
 *  including multi-line content with URLs. */
export function parseDelegations(text: string): { agentId: string; task: string }[] {
  const results: { agentId: string; task: string }[] = [];
  const regex = /\[DELEGATE:([^\]]+)\]\s*([\s\S]+?)(?=\[DELEGATE:|$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const task = match[2].trim();
    if (task.length > 0) {
      results.push({
        agentId: match[1].trim(),
        task,
      });
    }
  }
  return results;
}

/** Check if a candidate appears as a whole word/phrase in text (not as a substring of another word). */
function matchesWholeWord(text: string, candidate: string): boolean {
  // Escape regex special chars in the candidate
  const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[\\s,;:.!?—–\\-/"'(])${escaped}(?=[\\s,;:.!?—–\\-/"')]|$)`, "i").test(text);
}

/**
 * Detect known agent names in text using whole-word matching.
 * Used to find which spawned subagents the user mentioned in their message.
 */
/**
 * Detect known agent names in text using whole-word matching.
 * Returns matched agentIds. The task forwarded is always the full searchText.
 */
export function detectNaturalLanguageDelegation(
  searchText: string,
  task: string,
  knownAgents: { agentId: string; name: string }[],
): { agentId: string; task: string }[] {
  if (knownAgents.length === 0 || !searchText) return [];

  const lower = searchText.toLowerCase();
  const results: { agentId: string; task: string }[] = [];
  const matchedIds = new Set<string>();

  for (const agent of knownAgents) {
    if (matchedIds.has(agent.agentId)) continue;

    const name = agent.name.toLowerCase();
    const idSpaced = agent.agentId.replace(/-/g, " ").toLowerCase();

    const nameWords = name.split(/\s+/);
    const isMultiWord = nameWords.length >= 2;

    const initials = nameWords
      .filter(w => w.length > 0)
      .map(w => w[0])
      .join("");

    let matched = false;

    if (isMultiWord && matchesWholeWord(lower, name)) {
      matched = true;
    } else if (isMultiWord && matchesWholeWord(lower, idSpaced)) {
      matched = true;
    } else if (initials.length >= 3 && matchesWholeWord(lower, initials.toLowerCase())) {
      matched = true;
    }

    if (matched) {
      matchedIds.add(agent.agentId);
      results.push({ agentId: agent.agentId, task });
    }
  }

  return results;
}

const RELAY_INITIAL_DELAY_MS = 4000;  // Wait before sending to avoid rate limits
const RETRY_DELAYS_MS = [8000, 15000, 25000];  // Backoff on overload
const MAX_RETRIES = 3;

function isOverloadError(err: unknown): boolean {
  const msg = String((err as Error)?.message || err).toLowerCase();
  return msg.includes("overloaded") || msg.includes("rate") || msg.includes("529") || msg.includes("too many");
}

/** Send a message to a subagent session and collect the full streamed response. */
export async function relayToSubagent(
  agentId: string,
  task: string,
  timeoutMs: number = 300000,  // 5 minutes — heavy context can take a while
): Promise<RelayResult> {
  // Find the subagent session
  const session = sessionManager.getSessions().find(s => s.agentId === agentId);
  if (!session) {
    return {
      agentId,
      agentName: agentId,
      sessionId: "",
      response: "",
      success: false,
      error: `No active session for subagent "${agentId}"`,
    };
  }

  const agentName = session.name;

  // Register this session as an active relay so the main handler can ignore its events
  activeRelaySessions.add(session.id);

  // Wait before sending to let the gateway/LLM cool down after the main agent's response
  notifyStatus("sending", agentName);
  await delay(RELAY_INITIAL_DELAY_MS);

  // Resolve provider from active gateway
  const gateways = useGatewayStore.getState().gateways;
  const activeGatewayId = useGatewayStore.getState().activeGatewayId;
  const gw = gateways.find(g => g.id === activeGatewayId);
  const provider = getProvider(gw?.providerType || "openclaw");

  // Send just the task — the subagent session already has its system prompt
  // and full conversation context on the gateway side
  const messageText = task;

  // Retry wrapper for the actual send
  const attemptSend = async (attempt: number): Promise<RelayResult> => {
    return new Promise<RelayResult>((resolve) => {
      let accumulated = "";
      let relayRunId: string | null = null;
      let settled = false;

      const cleanup = () => {
        unsub();
        clearTimeout(timer);
      };

      const settle = (result: RelayResult) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      // Rolling timeout — resets every time a token arrives.
      // Only fires if the connection goes completely silent.
      let timer: ReturnType<typeof setTimeout>;
      const resetTimeout = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          settle({
            agentId,
            agentName,
            sessionId: session.id,
            response: accumulated || "",
            success: accumulated.length > 0,  // partial response is still useful
            error: accumulated.length > 0 ? undefined : `Relay timed out after ${timeoutMs / 1000}s of silence`,
          });
        }, timeoutMs);
      };
      resetTimeout();

      // Listen for streaming events on the target session
      const unsub = gatewayClient.onMessage((msg: GatewayMessage) => {
        const payload = msg.payload;
        const msgSessionKey = payload?.sessionKey as string | undefined;
        const msgRunId = payload?.runId as string | undefined;

        // Match by session key (includes for expanded keys) OR by runId
        const sessionMatch = msgSessionKey && msgSessionKey.includes(session.id);
        const runIdMatch = relayRunId && msgRunId && msgRunId === relayRunId;

        if (!sessionMatch && !runIdMatch) return;

        switch (msg.type) {
          case "chat_token": {
            if (!settled) notifyStatus("streaming", agentName);
            const text = provider.extractText(payload?.message);
            if (text) accumulated += text;
            resetTimeout();  // Keep alive while tokens are flowing
            break;
          }
          case "chat_done": {
            const finalContent = payload?.message;
            if (finalContent) {
              const finalText = provider.extractText(finalContent);
              if (finalText && !accumulated.includes(finalText)) {
                accumulated = finalText;
              }
            }
            settle({
              agentId,
              agentName,
              sessionId: session.id,
              response: accumulated,
              success: true,
            });
            break;
          }
          case "chat_error": {
            const errorMessage = (payload?.errorMessage as string) || (payload?.message as string) || "Unknown error";
            settle({
              agentId,
              agentName,
              sessionId: session.id,
              response: accumulated,
              success: false,
              error: errorMessage,
            });
            break;
          }
        }
      });

      // Send the message
      const idempotencyKey = makeIdempotencyKey(`relay_${agentId}_${Date.now()}_${attempt}`);
      const chatReq = provider.buildChatSend(session.id, messageText, idempotencyKey);
      gatewayClient.request(chatReq.method, chatReq.params)
        .then((result) => {
          const res = result as Record<string, unknown> | undefined;
          if (res?.runId) {
            relayRunId = res.runId as string;
            activeRelayRunIds.add(relayRunId);
          }
          // Gateway accepted the request — update status
          if (!settled) notifyStatus("streaming", agentName);
        })
        .catch((err) => {
          settle({
            agentId,
            agentName,
            sessionId: session.id,
            response: "",
            success: false,
            error: `Failed to send: ${err?.message || String(err)}`,
          });
        });
    });
  };

  // Attempt with retries on overload
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await attemptSend(attempt);

    if (result.success) {
      // Don't clean up activeRelaySessions here — caller cleans up after
      // injecting the response back to main via clearRelaySession()
      // Don't auto-dismiss to idle — caller manages the full lifecycle
      // (sending → streaming → done → relaying → idle)
      return result;
    }

    // Retry on overload errors, give up on other errors
    if (!isOverloadError(result.error) || attempt === MAX_RETRIES) {
      clearRelaySession(session.id);
      notifyStatus("error", agentName);
      // Keep error visible — caller dismisses when ready
      return result;
    }

    // Backoff before retry
    const backoff = RETRY_DELAYS_MS[attempt] || 12000;
    notifyStatus("sending", `${agentName} (retry ${attempt + 1}/${MAX_RETRIES})`);
    await delay(backoff);
  }

  // Should not reach here, but just in case
  clearRelaySession(session.id);
  notifyStatus("idle", agentName);
  return {
    agentId,
    agentName,
    sessionId: session.id,
    response: "",
    success: false,
    error: "Exhausted retries",
  };
}
