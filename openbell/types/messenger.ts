// ─── Messenger Types ─────────────────────────────────────────────────────────
// Slack-style chat for human-to-human and human-to-AI conversations.
// Separate from OpenClaw agent types to keep concerns clean.

export type MessengerChannelType = "public" | "private" | "dm" | "group_dm" | "slack_bridge";

export type MessengerMessageSource = "gateway" | "slack" | "agent";

export type MessengerMessageStatus = "optimistic" | "sent" | "delivered" | "error";

export type PresenceStatus = "online" | "away" | "offline";

// ─── Channel ─────────────────────────────────────────────────────────────────

export interface MessengerChannel {
  id: string;
  name: string;
  description?: string;
  type: MessengerChannelType;
  icon?: string;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  lastMessage?: string;
  lastMessageAt?: string;
  memberCount: number;
  pinnedMessageIds: string[];
  // Slack bridge fields
  slackChannelId?: string;
  slackTeamId?: string;
}

// ─── Member ──────────────────────────────────────────────────────────────────

export type MemberRole = "owner" | "admin" | "member";

export interface MessengerMember {
  id: string;
  channelId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: MemberRole;
  joinedAt: string;
  isAgent?: boolean;
}

// ─── Message ─────────────────────────────────────────────────────────────────

export interface MessengerReaction {
  emoji: string;
  count: number;
  userIds: string[];
  includesMe: boolean;
}

export interface MessengerFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
}

export interface MessengerMessage {
  id: string;
  channelId: string;
  threadId?: string; // parent message ID if this is a thread reply
  userId: string;
  displayName: string;
  avatarUrl?: string;
  isAgent?: boolean;
  content: string;
  source: MessengerMessageSource;
  status: MessengerMessageStatus;
  isEdited: boolean;
  isPinned: boolean;
  reactions: MessengerReaction[];
  files: MessengerFile[];
  threadCount: number;
  createdAt: string;
  updatedAt: string;
  // Client-side optimistic tracking
  clientMessageId?: string;
}

// ─── User / Presence ─────────────────────────────────────────────────────────

export interface MessengerUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
  presence: PresenceStatus;
  isAgent: boolean;
  lastSeenAt?: string;
}

// ─── Typing ──────────────────────────────────────────────────────────────────

export interface TypingUser {
  userId: string;
  displayName: string;
  channelId: string;
  threadId?: string;
  expiresAt: number; // timestamp for auto-expiry
}

// ─── Protocol Message Types ──────────────────────────────────────────────────

export type MessengerEventType =
  // Channels
  | "messenger:channel:list"
  | "messenger:channel:created"
  | "messenger:channel:updated"
  | "messenger:channel:deleted"
  | "messenger:channel:joined"
  | "messenger:channel:left"
  // Messages
  | "messenger:message:new"
  | "messenger:message:ack"
  | "messenger:message:edited"
  | "messenger:message:deleted"
  // Threads
  | "messenger:thread:updated" // thread count changed
  // Reactions
  | "messenger:reaction:updated"
  // Typing
  | "messenger:typing:update"
  // Presence
  | "messenger:presence:update"
  | "messenger:presence:bulk"
  // Members
  | "messenger:member:joined"
  | "messenger:member:left"
  // Read tracking
  | "messenger:read:update";
