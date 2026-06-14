// ─── Agent Bridge ────────────────────────────────────────────────────────────
// Bridges AI agents into Messenger channels. When a user @mentions an agent
// in a channel, this service:
// 1. Sends the message to the OpenClaw Gateway's chat protocol
// 2. Assembles the streaming response (tokens, tool calls)
// 3. Posts the final response back into the Messenger channel as an agent message

import { create } from "zustand";
import { gatewayClient } from "@/services/gateway/gatewayClient";
import { getProvider } from "@/services/gateway/providers/registry";
import { useGatewayStore } from "@/stores/gatewayStore";
import { useMessengerStore } from "@/stores/messengerStore";
import { makeIdempotencyKey } from "@/services/gateway";
import * as messengerProto from "./messengerProtocol";
import type { GatewayMessage } from "@/types/gateway";
import type { MessengerMessage } from "@/types/messenger";
import type { OpenClawToolCall } from "@/types/openclaw";

// ─── Agent Mention Detection ─────────────────────────────────────────────────

const MENTION_REGEX = /@(\w[\w-]*)/g;

/**
 * Extract agent mentions from message content.
 * Returns array of agent names mentioned (without the @ prefix).
 */
export function extractAgentMentions(content: string): string[] {
  const mentions: string[] = [];
  let match;
  while ((match = MENTION_REGEX.exec(content)) !== null) {
    mentions.push(match[1]);
  }
  MENTION_REGEX.lastIndex = 0; // reset stateful regex
  return mentions;
}

/**
 * Check if a message mentions any known agent.
 */
export function getTargetAgent(content: string): { agentId: string; agentName: string } | null {
  const mentions = extractAgentMentions(content);
  if (mentions.length === 0) return null;

  const agents = useGatewayStore.getState().agents;
  for (const mention of mentions) {
    const agent = agents.find(
      (a) => a.name.toLowerCase() === mention.toLowerCase() || a.id === mention
    );
    if (agent) {
      return { agentId: agent.id, agentName: agent.name };
    }
  }
  return null;
}

// ─── Reactive Agent Stream Store ──────────────────────────────────────────────
// Zustand store so UI components can reactively subscribe to agent stream state.

interface AgentStreamStoreState {
  isStreaming: boolean;
  agentName: string | null;
  channelId: string | null;
  content: string;
  toolCalls: OpenClawToolCall[];
  _set: (updates: Partial<Omit<AgentStreamStoreState, "_set">>) => void;
}

export const useAgentStreamStore = create<AgentStreamStoreState>((set) => ({
  isStreaming: false,
  agentName: null,
  channelId: null,
  content: "",
  toolCalls: [],
  _set: (updates) => set(updates),
}));

// ─── Streaming State ─────────────────────────────────────────────────────────

interface AgentStreamState {
  channelId: string;
  threadId?: string;
  agentId: string;
  agentName: string;
  content: string;
  toolCalls: OpenClawToolCall[];
  runId: string | null;
  placeholderMessageId: string;
  /** Unique tag for this stream — used to filter Gateway events */
  streamTag: string;
}

let activeStream: AgentStreamState | null = null;
let unsubscribeStream: (() => void) | null = null;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Invoke an agent in a Messenger channel.
 * Creates a typing indicator, sends the message to the Gateway's chat protocol,
 * assembles the streaming response, and posts it as an agent message.
 */
export async function invokeAgentInChannel(
  channelId: string,
  content: string,
  agentId: string,
  agentName: string,
  threadId?: string
): Promise<void> {
  const store = useMessengerStore.getState();
  const gwStore = useGatewayStore.getState();

  // Strip the @mention from the content for the agent
  const cleanContent = content.replace(new RegExp(`@${agentName}\\b`, "gi"), "").trim();
  if (!cleanContent) return;

  // Create a placeholder "typing" message for the agent
  const placeholderId = `agent_typing_${Date.now()}`;
  const placeholder: MessengerMessage = {
    id: placeholderId,
    channelId,
    threadId,
    userId: `agent:${agentId}`,
    displayName: agentName,
    isAgent: true,
    content: "",
    source: "agent",
    status: "optimistic",
    isEdited: false,
    isPinned: false,
    reactions: [],
    files: [],
    threadCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (threadId) {
    store.addThreadMessage(placeholder);
  } else {
    store.addMessage(placeholder);
  }

  // Use a unique session key prefixed with "messenger:" so the OpenClaw tab's
  // useOpenClawStream hook (which filters by activeSessionId) ignores these events.
  const streamTag = `messenger:${agentId}:${Date.now()}`;
  const sessionKey = `messenger:agent:${agentId}`;

  // Set up streaming state
  activeStream = {
    channelId,
    threadId,
    agentId,
    agentName,
    content: "",
    toolCalls: [],
    runId: null,
    placeholderMessageId: placeholderId,
    streamTag,
  };

  // Update reactive store for UI
  useAgentStreamStore.getState()._set({
    isStreaming: true,
    agentName,
    channelId,
    content: "",
    toolCalls: [],
  });

  // Subscribe to streaming events
  startStreamListener();

  try {
    // Resolve provider and send
    const gw = gwStore.gateways.find((g) => g.id === gwStore.activeGatewayId);
    const provider = getProvider(gw?.providerType || "openclaw");

    const chatReq = provider.buildChatSend(
      sessionKey,
      cleanContent,
      makeIdempotencyKey(placeholderId)
    );

    const result = await gatewayClient.request(chatReq.method, chatReq.params) as Record<string, unknown> | undefined;

    if (result?.runId && activeStream) {
      activeStream.runId = result.runId as string;
    }
  } catch (err) {
    // Failed to send — update placeholder to error state
    const store = useMessengerStore.getState();
    store.updateMessage(placeholderId, {
      content: `Failed to invoke agent: ${err instanceof Error ? err.message : "Unknown error"}`,
      status: "error",
    });
    cleanupStream();
  }
}

// ─── Stream Listener ─────────────────────────────────────────────────────────

function startStreamListener() {
  if (unsubscribeStream) return;

  unsubscribeStream = gatewayClient.onMessage((msg: GatewayMessage) => {
    if (!activeStream) return;

    const store = useMessengerStore.getState();
    const stream = activeStream;

    switch (msg.type) {
      case "chat_token": {
        // Ignore events that belong to the OpenClaw tab's session
        const gwSessionId = msg.sessionId || (msg.payload?.sessionKey as string);
        if (gwSessionId && !gwSessionId.startsWith("messenger:")) {
          return; // Not ours — let useOpenClawStream handle it
        }

        const payload = msg.payload;
        const gw = useGatewayStore.getState().gateways.find(
          (g) => g.id === useGatewayStore.getState().activeGatewayId
        );
        const provider = getProvider(gw?.providerType || "openclaw");
        const text = provider.extractText(payload?.message);

        if (text && text.length > stream.content.length) {
          stream.content = text;
          store.updateMessage(stream.placeholderMessageId, { content: text });
          useAgentStreamStore.getState()._set({ content: text });
        }
        break;
      }

      case "chat_tool_call": {
        const gwSessionId2 = msg.sessionId || (msg.payload?.sessionKey as string);
        if (gwSessionId2 && !gwSessionId2.startsWith("messenger:")) return;

        const payload = msg.payload;
        const toolCallId = (payload?.toolCallId as string) || `tc_${Date.now()}`;
        const name = (payload?.name as string) || (payload?.toolName as string) || "";

        const existing = stream.toolCalls.find((t) => t.id === toolCallId);
        if (existing) {
          if (payload?.output !== undefined) {
            existing.status = "completed";
            existing.output = payload.output;
            existing.completedAt = new Date().toISOString();
          }
        } else {
          stream.toolCalls.push({
            id: toolCallId,
            toolName: name,
            status: "running",
            input: payload?.args as Record<string, unknown>,
            startedAt: new Date().toISOString(),
          });
        }
        useAgentStreamStore.getState()._set({ toolCalls: [...stream.toolCalls] });
        break;
      }

      case "chat_done": {
        const gwSessionId3 = msg.sessionId || (msg.payload?.sessionKey as string);
        if (gwSessionId3 && !gwSessionId3.startsWith("messenger:")) return;

        const payload = msg.payload;
        const gw = useGatewayStore.getState().gateways.find(
          (g) => g.id === useGatewayStore.getState().activeGatewayId
        );
        const provider = getProvider(gw?.providerType || "openclaw");
        const finalText = provider.extractText(payload?.message) || stream.content;

        store.updateMessage(stream.placeholderMessageId, {
          content: finalText,
          status: "delivered",
        });

        postAgentResponse(stream, finalText);
        cleanupStream();
        break;
      }

      case "chat_error": {
        const gwSessionId4 = msg.sessionId || (msg.payload?.sessionKey as string);
        if (gwSessionId4 && !gwSessionId4.startsWith("messenger:")) return;

        const payload = msg.payload;
        const errorText = (payload?.errorMessage as string) || (payload?.message as string) || "Agent error";

        store.updateMessage(stream.placeholderMessageId, {
          content: `Error: ${errorText}`,
          status: "error",
        });

        cleanupStream();
        break;
      }
    }
  });
}

function cleanupStream() {
  activeStream = null;
  if (unsubscribeStream) {
    unsubscribeStream();
    unsubscribeStream = null;
  }
  useAgentStreamStore.getState()._set({
    isStreaming: false,
    agentName: null,
    channelId: null,
    content: "",
    toolCalls: [],
  });
}

/**
 * Post the agent's response to the Messenger channel via the Gateway
 * so other connected clients can see it.
 */
async function postAgentResponse(stream: AgentStreamState, content: string) {
  try {
    const { method, params } = messengerProto.messageSend(
      stream.channelId,
      content,
      {
        threadId: stream.threadId,
        clientMessageId: stream.placeholderMessageId,
      }
    );
    // The Gateway should recognize this as an agent-sourced message
    await gatewayClient.request(method, {
      ...params,
      source: "agent",
      agentId: stream.agentId,
      agentName: stream.agentName,
    });
  } catch {
    // Best-effort — local display already shows the message
  }
}

// ─── Agent Presence ──────────────────────────────────────────────────────────

/**
 * Check if an agent is currently streaming (for typing indicator purposes).
 */
export function isAgentStreaming(): boolean {
  return activeStream !== null;
}

/**
 * Get the currently active agent stream info (for UI display).
 */
export function getActiveAgentStream(): {
  agentName: string;
  channelId: string;
  toolCalls: OpenClawToolCall[];
} | null {
  if (!activeStream) return null;
  return {
    agentName: activeStream.agentName,
    channelId: activeStream.channelId,
    toolCalls: [...activeStream.toolCalls],
  };
}
