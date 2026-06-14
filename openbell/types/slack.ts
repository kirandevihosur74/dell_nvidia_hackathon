// ─── Slack Integration Types ─────────────────────────────────────────────────
// Types for Slack workspace connections, channel bridging, and user mapping.

export type SlackConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

// ─── Workspace ───────────────────────────────────────────────────────────────

export interface SlackWorkspace {
  id: string; // Slack team ID
  name: string;
  domain: string; // e.g. "mycompany" → mycompany.slack.com
  iconUrl?: string;
  connectedAt: string;
  status: SlackConnectionStatus;
  botScopes: string[];
  userScopes: string[];
}

// ─── Slack Channel (for bridging picker) ─────────────────────────────────────

export interface SlackChannel {
  id: string; // Slack channel ID (C...)
  name: string;
  isPrivate: boolean;
  isMember: boolean;
  memberCount: number;
  topic?: string;
  purpose?: string;
  /** If non-null, this Slack channel is already bridged to a messenger channel */
  bridgedMessengerChannelId?: string;
}

// ─── Slack User Mapping ──────────────────────────────────────────────────────

export interface SlackUserMapping {
  slackUserId: string;
  slackDisplayName: string;
  slackAvatarUrl?: string;
  messengerUserId?: string; // linked messenger user, if any
  isBot: boolean;
}

// ─── Bridge Config ───────────────────────────────────────────────────────────

export interface SlackBridge {
  messengerChannelId: string;
  slackChannelId: string;
  slackTeamId: string;
  slackChannelName: string;
  syncDirection: "bidirectional" | "slack_to_messenger" | "messenger_to_slack";
  syncReactions: boolean;
  syncThreads: boolean;
  syncFiles: boolean;
  createdAt: string;
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export interface SlackOAuthConfig {
  authUrl: string;
  state: string; // CSRF token
  redirectUri: string;
}

export interface SlackOAuthResult {
  success: boolean;
  workspace?: SlackWorkspace;
  error?: string;
}
