// ─── Messenger Protocol ──────────────────────────────────────────────────────
// Builder functions for messenger-specific Gateway requests.
// Uses the Gateway's req/res protocol: gatewayClient.request(method, params)

import type { MessengerChannelType } from "@/types/messenger";

// ─── Channels ────────────────────────────────────────────────────────────────

export function channelList() {
  return { method: "messenger.channel.list", params: {} };
}

export function channelCreate(
  name: string,
  type: MessengerChannelType = "public",
  description?: string
) {
  return {
    method: "messenger.channel.create",
    params: { name, type, description },
  };
}

export function channelJoin(channelId: string) {
  return { method: "messenger.channel.join", params: { channelId } };
}

export function channelLeave(channelId: string) {
  return { method: "messenger.channel.leave", params: { channelId } };
}

export function channelUpdate(
  channelId: string,
  updates: { name?: string; description?: string }
) {
  return { method: "messenger.channel.update", params: { channelId, ...updates } };
}

// ─── Messages ────────────────────────────────────────────────────────────────

export function messageList(
  channelId: string,
  cursor?: string,
  limit = 50
) {
  return {
    method: "messenger.message.list",
    params: { channelId, cursor, limit },
  };
}

export function messageSend(
  channelId: string,
  content: string,
  options?: {
    threadId?: string;
    fileIds?: string[];
    mentionedUserIds?: string[];
    clientMessageId?: string;
  }
) {
  return {
    method: "messenger.message.send",
    params: { channelId, content, ...options },
  };
}

export function messageEdit(messageId: string, content: string) {
  return { method: "messenger.message.edit", params: { messageId, content } };
}

export function messageDelete(messageId: string) {
  return { method: "messenger.message.delete", params: { messageId } };
}

export function messagePin(messageId: string) {
  return { method: "messenger.message.pin", params: { messageId } };
}

export function messageUnpin(messageId: string) {
  return { method: "messenger.message.unpin", params: { messageId } };
}

// ─── Threads ─────────────────────────────────────────────────────────────────

export function threadList(parentMessageId: string, cursor?: string, limit = 50) {
  return {
    method: "messenger.thread.list",
    params: { parentMessageId, cursor, limit },
  };
}

// ─── Reactions ───────────────────────────────────────────────────────────────

export function reactionAdd(messageId: string, emoji: string) {
  return { method: "messenger.reaction.add", params: { messageId, emoji } };
}

export function reactionRemove(messageId: string, emoji: string) {
  return { method: "messenger.reaction.remove", params: { messageId, emoji } };
}

// ─── Typing ──────────────────────────────────────────────────────────────────

export function typingStart(channelId: string, threadId?: string) {
  return { method: "messenger.typing.start", params: { channelId, threadId } };
}

// ─── Presence ────────────────────────────────────────────────────────────────

export function presenceUpdate(status: "online" | "away") {
  return { method: "messenger.presence.update", params: { status } };
}

// ─── Members ─────────────────────────────────────────────────────────────────

export function memberList(channelId: string) {
  return { method: "messenger.member.list", params: { channelId } };
}

// ─── Read Tracking ───────────────────────────────────────────────────────────

export function readUpdate(channelId: string, lastReadMessageId: string) {
  return {
    method: "messenger.read.update",
    params: { channelId, lastReadMessageId },
  };
}

// ─── File Upload ─────────────────────────────────────────────────────────────

export function fileUpload(channelId: string, fileName: string, mimeType: string) {
  return {
    method: "messenger.file.upload",
    params: { channelId, fileName, mimeType },
  };
}

// ─── DM ──────────────────────────────────────────────────────────────────────

export function dmCreate(userIds: string[]) {
  return {
    method: "messenger.dm.create",
    params: { userIds },
  };
}

// ─── Users ───────────────────────────────────────────────────────────────────

export function userList() {
  return { method: "messenger.user.list", params: {} };
}
