import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Message, Conversation } from "@/types/chat";

const CONVERSATIONS_KEY = "offline_conversations";
const MESSAGES_PREFIX = "offline_messages_";

/**
 * Persist conversations list to AsyncStorage.
 */
export async function cacheConversations(conversations: Conversation[]): Promise<void> {
  await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

/**
 * Load cached conversations from AsyncStorage.
 */
export async function getCachedConversations(): Promise<Conversation[]> {
  const data = await AsyncStorage.getItem(CONVERSATIONS_KEY);
  return data ? JSON.parse(data) : [];
}

/**
 * Persist messages for a conversation.
 */
export async function cacheMessages(conversationId: string, messages: Message[]): Promise<void> {
  await AsyncStorage.setItem(`${MESSAGES_PREFIX}${conversationId}`, JSON.stringify(messages));
}

/**
 * Load cached messages for a conversation.
 */
export async function getCachedMessages(conversationId: string): Promise<Message[]> {
  const data = await AsyncStorage.getItem(`${MESSAGES_PREFIX}${conversationId}`);
  return data ? JSON.parse(data) : [];
}

/**
 * Clear all cached conversation data.
 */
export async function clearOfflineCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const offlineKeys = keys.filter(
    (k) => k === CONVERSATIONS_KEY || k.startsWith(MESSAGES_PREFIX)
  );
  await AsyncStorage.multiRemove(offlineKeys);
}

/**
 * Get approximate cache size in bytes.
 */
export async function getCacheSize(): Promise<number> {
  const keys = await AsyncStorage.getAllKeys();
  const offlineKeys = keys.filter(
    (k) => k === CONVERSATIONS_KEY || k.startsWith(MESSAGES_PREFIX) || k === "cached_tasks" || k === "pending_actions"
  );
  let totalSize = 0;
  for (const key of offlineKeys) {
    const value = await AsyncStorage.getItem(key);
    if (value) totalSize += value.length;
  }
  return totalSize;
}
