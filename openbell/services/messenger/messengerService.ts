// ─── Messenger Service ───────────────────────────────────────────────────────
// Orchestrates messenger operations: sends requests via gatewayClient,
// listens for events, and updates messengerStore.

import * as Crypto from "expo-crypto";
import { gatewayClient } from "@/services/gateway/gatewayClient";
import { useMessengerStore } from "@/stores/messengerStore";
import * as proto from "./messengerProtocol";
import * as messengerApi from "./messengerApi";
import type {
  MessengerChannel,
  MessengerMessage,
  MessengerUser,
  MessengerReaction,
  PresenceStatus,
  TypingUser,
  MessengerEventType,
} from "@/types/messenger";
import type { GatewayMessage } from "@/types/gateway";

const TYPING_DEBOUNCE_MS = 2000;
const TYPING_EXPIRY_MS = 4000;
const TYPING_CLEANUP_INTERVAL = 2000;

let typingCleanupTimer: ReturnType<typeof setInterval> | null = null;
let lastTypingSent = 0;
let unsubscribeMessages: (() => void) | null = null;

// ─── Event Listener ──────────────────────────────────────────────────────────

function handleGatewayEvent(msg: GatewayMessage) {
  const type = msg.type as string;

  // Only handle messenger events
  if (!type.startsWith("messenger:")) return;

  const store = useMessengerStore.getState();
  const payload = msg.payload as Record<string, unknown>;

  switch (type as MessengerEventType) {
    // ─── Channel Events ──────────────────────────────────────────────
    case "messenger:channel:list":
      store.setChannels(payload.channels as MessengerChannel[]);
      break;

    case "messenger:channel:created":
      store.addChannel(payload.channel as MessengerChannel);
      break;

    case "messenger:channel:updated":
      store.updateChannel(
        payload.channelId as string,
        payload.updates as Partial<MessengerChannel>
      );
      break;

    case "messenger:channel:deleted":
      store.removeChannel(payload.channelId as string);
      break;

    // ─── Message Events ──────────────────────────────────────────────
    case "messenger:message:new": {
      const message = payload.message as MessengerMessage;
      const isOwnMessage = message.userId === store.currentUserId;

      if (message.threadId) {
        // Thread reply
        if (message.threadId === store.activeThreadId) {
          store.addThreadMessage(message);
        }
        // Update thread count on parent
        store.updateMessage(message.threadId, {
          threadCount: (payload.threadCount as number) || 0,
        });
      } else {
        store.addMessage(message);
      }

      // Update channel last message
      store.updateChannel(message.channelId, {
        lastMessage: message.content.slice(0, 100),
        lastMessageAt: message.createdAt,
      });

      // Increment unread if not the active channel and not our own message
      if (!isOwnMessage) {
        store.incrementUnread(message.channelId);
      }

      // Remove typing indicator for this user
      store.removeTypingUser(message.userId, message.channelId);
      break;
    }

    case "messenger:message:ack": {
      const clientMessageId = payload.clientMessageId as string;
      const serverMessage = payload.message as MessengerMessage;
      store.confirmMessage(clientMessageId, serverMessage);
      break;
    }

    case "messenger:message:edited":
      store.updateMessage(payload.messageId as string, {
        content: payload.content as string,
        isEdited: true,
        updatedAt: payload.updatedAt as string,
      });
      break;

    case "messenger:message:deleted":
      store.removeMessage(
        payload.messageId as string,
        payload.channelId as string
      );
      break;

    // ─── Reaction Events ─────────────────────────────────────────────
    case "messenger:reaction:updated":
      store.updateReactions(
        payload.messageId as string,
        payload.channelId as string,
        payload.reactions as MessengerReaction[]
      );
      break;

    // ─── Thread Events ───────────────────────────────────────────────
    case "messenger:thread:updated":
      store.updateMessage(payload.messageId as string, {
        threadCount: payload.threadCount as number,
      });
      break;

    // ─── Typing Events ───────────────────────────────────────────────
    case "messenger:typing:update": {
      const typingUser: TypingUser = {
        userId: payload.userId as string,
        displayName: payload.displayName as string,
        channelId: payload.channelId as string,
        threadId: payload.threadId as string | undefined,
        expiresAt: Date.now() + TYPING_EXPIRY_MS,
      };
      // Don't show our own typing
      if (typingUser.userId !== store.currentUserId) {
        store.addTypingUser(typingUser);
      }
      break;
    }

    // ─── Presence Events ─────────────────────────────────────────────
    case "messenger:presence:update":
      store.updatePresence(
        payload.userId as string,
        payload.presence as PresenceStatus
      );
      break;

    case "messenger:presence:bulk":
      store.updatePresenceBulk(
        payload.updates as Array<{ userId: string; presence: PresenceStatus }>
      );
      break;

    // ─── Member Events ───────────────────────────────────────────────
    case "messenger:member:joined":
    case "messenger:member:left":
      // Refresh member count
      if (payload.channelId) {
        store.updateChannel(payload.channelId as string, {
          memberCount: payload.memberCount as number,
        });
      }
      break;

    // ─── Read Events ─────────────────────────────────────────────────
    case "messenger:read:update":
      // Could update read receipts UI here
      break;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function startMessengerListener() {
  if (unsubscribeMessages) return; // already listening
  unsubscribeMessages = gatewayClient.onMessage(handleGatewayEvent);

  // Periodic typing indicator cleanup
  typingCleanupTimer = setInterval(() => {
    useMessengerStore.getState().cleanExpiredTyping();
  }, TYPING_CLEANUP_INTERVAL);
}

export function stopMessengerListener() {
  unsubscribeMessages?.();
  unsubscribeMessages = null;
  if (typingCleanupTimer) {
    clearInterval(typingCleanupTimer);
    typingCleanupTimer = null;
  }
}

// ─── Channel Operations ──────────────────────────────────────────────────────

export async function fetchChannels(): Promise<void> {
  const store = useMessengerStore.getState();
  store.setIsLoadingChannels(true);
  try {
    const channels = await messengerApi.fetchChannels();
    store.setChannels(channels);
  } catch (err) {
    console.warn("[messenger] fetchChannels failed:", err);
  } finally {
    store.setIsLoadingChannels(false);
  }
}

export async function createChannel(
  name: string,
  type: "public" | "private" = "public",
  description?: string
): Promise<MessengerChannel | null> {
  try {
    const channel = await messengerApi.createChannel(name, type, description);
    useMessengerStore.getState().addChannel(channel);
    return channel;
  } catch (err) {
    console.warn("[messenger] createChannel failed:", err);
    return null;
  }
}

export async function joinChannel(channelId: string): Promise<void> {
  const { method, params } = proto.channelJoin(channelId);
  await gatewayClient.request(method, params);
}

export async function leaveChannel(channelId: string): Promise<void> {
  const { method, params } = proto.channelLeave(channelId);
  await gatewayClient.request(method, params);
  useMessengerStore.getState().removeChannel(channelId);
}

// ─── Message Operations ──────────────────────────────────────────────────────

export async function fetchMessages(
  channelId: string,
  cursor?: string
): Promise<void> {
  const store = useMessengerStore.getState();
  store.setIsLoadingMessages(true);
  try {
    const result = await messengerApi.fetchMessages(channelId, cursor);
    if (cursor) {
      store.prependMessages(channelId, result.messages || []);
    } else {
      store.setMessages(channelId, result.messages || []);
    }
    store.setHasMore(channelId, result.hasMore ?? false);
  } catch (err) {
    console.warn("[messenger] fetchMessages failed:", err);
  } finally {
    store.setIsLoadingMessages(false);
  }
}

export async function sendMessage(
  channelId: string,
  content: string,
  options?: { threadId?: string; fileIds?: string[] }
): Promise<void> {
  const store = useMessengerStore.getState();
  const clientMessageId = Crypto.randomUUID();

  // Optimistic insert
  const optimistic: MessengerMessage = {
    id: `opt_${clientMessageId}`,
    channelId,
    threadId: options?.threadId,
    userId: store.currentUserId || "me",
    displayName: "You",
    content,
    source: "gateway",
    status: "optimistic",
    isEdited: false,
    isPinned: false,
    reactions: [],
    files: [],
    threadCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    clientMessageId,
  };

  if (options?.threadId) {
    store.addThreadMessage(optimistic);
  } else {
    store.addOptimisticMessage(optimistic);
  }

  try {
    const { method, params } = proto.messageSend(channelId, content, {
      ...options,
      clientMessageId,
    });
    await gatewayClient.request(method, params);
    // Server ack will come via messenger:message:ack event
  } catch (err) {
    store.failMessage(clientMessageId);
    console.warn("[messenger] sendMessage failed:", err);
  }
}

export async function editMessage(
  messageId: string,
  content: string
): Promise<void> {
  const { method, params } = proto.messageEdit(messageId, content);
  await gatewayClient.request(method, params);
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { method, params } = proto.messageDelete(messageId);
  await gatewayClient.request(method, params);
}

export async function pinMessage(messageId: string): Promise<void> {
  const { method, params } = proto.messagePin(messageId);
  await gatewayClient.request(method, params);
}

export async function unpinMessage(messageId: string): Promise<void> {
  const { method, params } = proto.messageUnpin(messageId);
  await gatewayClient.request(method, params);
}

// ─── Thread Operations ───────────────────────────────────────────────────────

export async function fetchThreadReplies(parentMessageId: string): Promise<void> {
  const store = useMessengerStore.getState();
  try {
    const messages = await messengerApi.fetchThreadReplies(parentMessageId);
    store.setThreadMessages(messages);
  } catch (err) {
    console.warn("[messenger] fetchThreadReplies failed:", err);
  }
}

// ─── Reaction Operations ─────────────────────────────────────────────────────

export async function addReaction(
  messageId: string,
  emoji: string
): Promise<void> {
  const { method, params } = proto.reactionAdd(messageId, emoji);
  await gatewayClient.request(method, params);
}

export async function removeReaction(
  messageId: string,
  emoji: string
): Promise<void> {
  const { method, params } = proto.reactionRemove(messageId, emoji);
  await gatewayClient.request(method, params);
}

// ─── Typing ──────────────────────────────────────────────────────────────────

export function sendTypingIndicator(
  channelId: string,
  threadId?: string
): void {
  const now = Date.now();
  if (now - lastTypingSent < TYPING_DEBOUNCE_MS) return;
  lastTypingSent = now;

  const { method, params } = proto.typingStart(channelId, threadId);
  gatewayClient.request(method, params).catch(() => {
    // typing is best-effort
  });
}

// ─── Presence ────────────────────────────────────────────────────────────────

export function setPresence(status: "online" | "away"): void {
  const { method, params } = proto.presenceUpdate(status);
  gatewayClient.request(method, params).catch(() => {});
}

// ─── Members ─────────────────────────────────────────────────────────────────

export async function fetchMembers(channelId: string): Promise<void> {
  const { method, params } = proto.memberList(channelId);
  await gatewayClient.request(method, params);
}

// ─── Read Tracking ───────────────────────────────────────────────────────────

export function markAsRead(channelId: string, lastMessageId: string): void {
  const { method, params } = proto.readUpdate(channelId, lastMessageId);
  gatewayClient.request(method, params).catch(() => {});
  useMessengerStore.getState().clearUnread(channelId);
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function fetchUsers(): Promise<void> {
  try {
    const result = await messengerApi.fetchUsers();
    const store = useMessengerStore.getState();
    store.setUsers(result.users || []);
    if (result.currentUserId) store.setCurrentUserId(result.currentUserId);
  } catch (err) {
    console.warn("[messenger] fetchUsers failed:", err);
  }
}

// ─── DM ──────────────────────────────────────────────────────────────────────

export async function createDM(userIds: string[]): Promise<MessengerChannel | null> {
  try {
    const channel = await messengerApi.createDM(userIds);
    useMessengerStore.getState().addChannel(channel);
    return channel;
  } catch (err) {
    console.warn("[messenger] createDM failed:", err);
    return null;
  }
}
