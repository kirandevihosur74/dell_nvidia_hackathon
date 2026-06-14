import type { ProviderType } from "@/services/gateway/providers/types";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "pairing" | "error";

export type AuthMethod = "pairing" | "tailscale" | "password";

export type ConnectionMethod = "manual" | "qr" | "invite" | "discovery" | "relay";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface GatewayConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  authMethod: AuthMethod;
  providerType?: ProviderType;
  tailscaleHostname?: string;
  password?: string;
  isPaired: boolean;
  lastConnected?: string;
  // Phase 1: QR Code Pairing
  connectionMethod?: ConnectionMethod;
  bootstrapToken?: string;
  wsUrl?: string;
  // Phase 3: Auto-Discovery
  discoveredAt?: string;
}

export interface GatewayAgent {
  id: string;
  name: string;
  description: string;
  icon: string;
  capabilities?: string[];
  model?: string;
}

// ─── Profile Types ──────────────────────────────────────────────────

export interface GatewayProfile {
  id: string;            // "profile_<timestamp>_<random>" or "default"
  displayName: string;   // Visible to the agent (e.g. "Felix", "Amara")
  avatarColor?: string;  // Hex color for visual identification
  createdAt: string;
  isDefault: boolean;    // Exactly one per gateway
}

export type GatewayProfileMap = {
  [gatewayId: string]: {
    profiles: GatewayProfile[];
    activeProfileId: string;
  };
};

// ─── Session Types ──────────────────────────────────────────────────

export type SessionStatus = "idle" | "thinking" | "streaming" | "done" | "error";

export interface GatewaySession {
  id: string;
  gatewayId: string;
  profileId?: string;    // Which profile owns this session (undefined = "default")
  agentId?: string;
  parentSessionId?: string;
  name: string;
  model?: string;
  thinkingLevel?: "off" | "low" | "medium" | "high";
  verbose: boolean;
  status?: SessionStatus;
  systemPrompt?: string;
  systemPromptSent?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PairingChallenge {
  code: string;
  expiresAt: string;
  direction: "display" | "enter";
}

/** Messages sent/received over the Gateway WebSocket protocol */
export type GatewayMessageType =
  | "auth"
  | "auth_challenge"
  | "auth_result"
  | "session_create"
  | "session_list"
  | "session_patch"
  | "session_delete"
  | "chat"
  | "chat_token"
  | "chat_tool_call"
  | "chat_tool_result"
  | "chat_done"
  | "chat_error"
  | "node_list"
  | "node_describe"
  | "node_invoke"
  | "ping"
  | "pong"
  | "error";

export interface GatewayMessage {
  type: GatewayMessageType;
  id?: string;
  sessionId?: string;
  payload?: Record<string, unknown>;
}

export interface GatewayAuthPayload {
  method: AuthMethod;
  pairingCode?: string;
  password?: string;
  tailscaleIdentity?: string;
  deviceName?: string;
}

export interface GatewayAuthResult {
  success: boolean;
  token?: string;
  error?: string;
}

// --- Workspace File Types (Gateway RPC: agents.files.*) ---

export interface GatewayFileEntry {
  name: string;
  path: string;
  missing: boolean;
  size: number;
  updatedAtMs: number;
}

export interface GatewayFileWithContent extends GatewayFileEntry {
  content: string;
}

// --- Cron Job Types (Gateway RPC: crons.*) ---

export interface CronJob {
  id: string;
  schedule: string;
  command: string;
  agentId: string;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
  createdAt: number;
}

// --- Token Usage Types (Gateway RPC: tokens.*) ---

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextLimit: number;
  costUsd: number;
}

// --- Kanban Types (Gateway RPC: kanban.*) ---

export type KanbanStatus = "backlog" | "todo" | "in-progress" | "review" | "done";

export interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  status: KanbanStatus;
  agentId?: string;
  priority?: "low" | "medium" | "high";
  version: number;
  createdAt: number;
  updatedAt: number;
}

export type ProposalAction = "create" | "update" | "move" | "complete";

export interface KanbanProposal {
  id: string;
  taskId?: string;
  action: ProposalAction;
  payload: Partial<KanbanTask>;
  reason: string;
  agentId: string;
  createdAt: number;
}
