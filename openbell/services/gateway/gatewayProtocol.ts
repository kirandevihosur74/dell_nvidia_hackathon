import type { GatewayMessage, GatewayAuthPayload, GatewayMessageType } from "@/types/gateway";

let messageCounter = 0;

function nextId(): string {
  messageCounter += 1;
  return `msg_${Date.now()}_${messageCounter}`;
}

/** Serialize a GatewayMessage to a JSON string for sending over WebSocket. */
export function encode(msg: GatewayMessage): string {
  return JSON.stringify(msg);
}

/** Deserialize a raw WebSocket message into a GatewayMessage. Returns null on malformed data. */
export function decode(raw: string): GatewayMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.type) return null;
    return parsed as GatewayMessage;
  } catch {
    return null;
  }
}

/** Build an auth message for the pairing flow. */
export function buildAuth(auth: GatewayAuthPayload): GatewayMessage {
  return {
    type: "auth",
    id: nextId(),
    payload: auth as unknown as Record<string, unknown>,
  };
}

/** Build a ping message for keepalive. */
export function buildPing(): GatewayMessage {
  return { type: "ping", id: nextId() };
}

/** Build a pong reply. */
export function buildPong(pingId?: string): GatewayMessage {
  return { type: "pong", id: pingId };
}

/** Build a chat message to send to the agent. */
export function buildChat(sessionId: string, content: string): GatewayMessage {
  return {
    type: "chat",
    id: nextId(),
    sessionId,
    payload: { content },
  };
}

/** Build a session create request. */
export function buildSessionCreate(name?: string, model?: string): GatewayMessage {
  return {
    type: "session_create",
    id: nextId(),
    payload: { name, model },
  };
}

/** Build a session list request. */
export function buildSessionList(): GatewayMessage {
  return { type: "session_list", id: nextId() };
}

/** Build a session patch (update config). */
export function buildSessionPatch(
  sessionId: string,
  updates: Record<string, unknown>
): GatewayMessage {
  return {
    type: "session_patch",
    id: nextId(),
    sessionId,
    payload: updates,
  };
}

/** Build a session delete request. */
export function buildSessionDelete(sessionId: string): GatewayMessage {
  return {
    type: "session_delete",
    id: nextId(),
    sessionId,
  };
}

/** Build a node list request (discover agent capabilities). */
export function buildNodeList(): GatewayMessage {
  return { type: "node_list", id: nextId() };
}

/** Build a node describe request. */
export function buildNodeDescribe(nodeId: string): GatewayMessage {
  return {
    type: "node_describe",
    id: nextId(),
    payload: { nodeId },
  };
}

/** Check if a message type is a chat streaming event. */
export function isChatStreamEvent(type: GatewayMessageType): boolean {
  return (
    type === "chat_token" ||
    type === "chat_tool_call" ||
    type === "chat_tool_result" ||
    type === "chat_done" ||
    type === "chat_error"
  );
}
