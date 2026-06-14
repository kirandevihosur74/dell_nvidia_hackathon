export type OpenClawMessageStatus = "queued" | "sending" | "sent" | "delivered" | "error";

export type OpenClawMessageRole = "user" | "assistant" | "system" | "tool";

export interface OpenClawMessageMeta {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheRead?: number;
  cacheWrite?: number;
  contextPercent?: number;
  source?: string;
}

export interface OpenClawMessage {
  id: string;
  sessionId: string;
  gatewayId: string;
  profileId?: string;   // Which profile sent/received this message
  channelId?: string;
  threadId?: string;
  role: OpenClawMessageRole;
  content: string;
  timestamp: string;
  status: OpenClawMessageStatus;
  imageData?: string; // base64 frame from live stream
  toolCalls?: OpenClawToolCall[];
  meta?: OpenClawMessageMeta;
  error?: string;
  isPinned?: boolean;
  threadCount?: number;
}

export interface OpenClawToolCall {
  id: string;
  toolName: string;
  status: "running" | "completed" | "error";
  progress?: number;
  input?: Record<string, unknown>;
  output?: unknown;
  startedAt: string;
  completedAt?: string;
}

export interface OpenClawChannel {
  id: string;
  gatewayId: string;
  name: string;
  description?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  lastMessage?: string;
  lastMessageAt?: string;
  pinnedMessageIds: string[];
}
