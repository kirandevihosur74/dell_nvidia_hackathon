import AsyncStorage from "@react-native-async-storage/async-storage";
import { e2eService } from "@/services/encryption";
import type { OpenClawMessage } from "@/types/openclaw";

const MESSAGES_PREFIX = "openclaw_messages_";
const QUEUE_KEY = "openclaw_message_queue";
const SYNC_CURSOR_PREFIX = "openclaw_sync_cursor_";
const ENCRYPTED_PREFIX = "openclaw_enc_";

// --- Message Caching ---

/** Persist messages for a session. Optionally encrypts if E2E is enabled. */
export async function cacheOpenClawMessages(
  sessionId: string,
  messages: OpenClawMessage[],
  gatewayId?: string
): Promise<void> {
  const storageKey = gatewayId ? `${sessionId}_${gatewayId}` : sessionId;
  const json = JSON.stringify(messages);

  if (gatewayId && e2eService.isEnabled()) {
    try {
      const encrypted = await e2eService.encryptForStorage(gatewayId, json);
      await AsyncStorage.setItem(`${ENCRYPTED_PREFIX}${storageKey}`, encrypted);
      // Remove unencrypted version if it exists
      await AsyncStorage.removeItem(`${MESSAGES_PREFIX}${storageKey}`);
      return;
    } catch {
      // Fall through to unencrypted storage
    }
  }

  await AsyncStorage.setItem(`${MESSAGES_PREFIX}${storageKey}`, json);
}

/** Load cached messages for a session. Handles both encrypted and unencrypted. */
export async function getCachedOpenClawMessages(
  sessionId: string,
  gatewayId?: string
): Promise<OpenClawMessage[]> {
  const storageKey = gatewayId ? `${sessionId}_${gatewayId}` : sessionId;
  // Try encrypted first
  if (gatewayId) {
    const encrypted = await AsyncStorage.getItem(`${ENCRYPTED_PREFIX}${storageKey}`);
    if (encrypted) {
      try {
        const decrypted = await e2eService.decryptFromStorage(gatewayId, encrypted);
        return JSON.parse(decrypted);
      } catch {
        // Fall through to unencrypted
      }
    }
  }

  // Unencrypted fallback
  const data = await AsyncStorage.getItem(`${MESSAGES_PREFIX}${storageKey}`);
  return data ? JSON.parse(data) : [];
}

// --- Message Queue ---

/** Queue a message for sending when connection is restored. */
export async function queueMessage(message: OpenClawMessage): Promise<void> {
  const queue = await getMessageQueue();
  queue.push(message);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/** Get all queued messages. */
export async function getMessageQueue(): Promise<OpenClawMessage[]> {
  const data = await AsyncStorage.getItem(QUEUE_KEY);
  return data ? JSON.parse(data) : [];
}

/** Remove a message from the queue by ID. */
export async function dequeueMessage(messageId: string): Promise<void> {
  const queue = await getMessageQueue();
  const filtered = queue.filter((m) => m.id !== messageId);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
}

/** Clear the entire queue. */
export async function clearMessageQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

/** Get queue size. */
export async function getQueueSize(): Promise<number> {
  const queue = await getMessageQueue();
  return queue.length;
}

// --- Delta Sync ---

/**
 * Store the last sync cursor for a session.
 * The cursor is typically the ID or timestamp of the last message synced.
 */
export async function setSyncCursor(sessionId: string, cursor: string): Promise<void> {
  await AsyncStorage.setItem(`${SYNC_CURSOR_PREFIX}${sessionId}`, cursor);
}

/** Get the last sync cursor for a session. */
export async function getSyncCursor(sessionId: string): Promise<string | null> {
  return AsyncStorage.getItem(`${SYNC_CURSOR_PREFIX}${sessionId}`);
}

/**
 * Merge new messages from the Gateway with cached messages.
 * Only adds messages that are newer than the last sync cursor.
 * Returns the merged list and the new cursor.
 */
export function mergeMessages(
  cached: OpenClawMessage[],
  incoming: OpenClawMessage[]
): { merged: OpenClawMessage[]; newCursor: string | null } {
  const existingIds = new Set(cached.map((m) => m.id));
  const newMessages = incoming.filter((m) => !existingIds.has(m.id));

  if (newMessages.length === 0) {
    return { merged: cached, newCursor: null };
  }

  const merged = [...cached, ...newMessages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const newCursor = newMessages[newMessages.length - 1].id;
  return { merged, newCursor };
}

// --- Cache Management ---

/** Clear all OpenClaw cached data (messages, queue, cursors). */
export async function clearOpenClawCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const openclawKeys = keys.filter(
    (k) =>
      k.startsWith(MESSAGES_PREFIX) ||
      k.startsWith(ENCRYPTED_PREFIX) ||
      k.startsWith(SYNC_CURSOR_PREFIX) ||
      k === QUEUE_KEY
  );
  await AsyncStorage.multiRemove(openclawKeys);
}

/** Get approximate cache size in bytes. */
export async function getOpenClawCacheSize(): Promise<number> {
  const keys = await AsyncStorage.getAllKeys();
  const openclawKeys = keys.filter(
    (k) =>
      k.startsWith(MESSAGES_PREFIX) ||
      k.startsWith(ENCRYPTED_PREFIX) ||
      k.startsWith(SYNC_CURSOR_PREFIX) ||
      k === QUEUE_KEY
  );
  let total = 0;
  for (const key of openclawKeys) {
    const value = await AsyncStorage.getItem(key);
    if (value) total += value.length;
  }
  return total;
}

/** Get count of cached sessions. */
export async function getCachedSessionCount(): Promise<number> {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter(
    (k) => k.startsWith(MESSAGES_PREFIX) || k.startsWith(ENCRYPTED_PREFIX)
  ).length;
}
