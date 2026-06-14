// ─── Messenger Search ────────────────────────────────────────────────────────
// Full-text search across messenger messages via the Gateway.
// Falls back to local search when the Gateway doesn't support it.

import { gatewayClient } from "@/services/gateway/gatewayClient";
import { useMessengerStore } from "@/stores/messengerStore";
import type { MessengerMessage } from "@/types/messenger";

export interface SearchResult {
  message: MessengerMessage;
  channelName: string;
  matchSnippet: string;
}

/**
 * Search messages across all channels.
 * Tries Gateway-side search first (FTS5), falls back to local.
 */
export async function searchMessages(
  query: string,
  options?: { channelId?: string; limit?: number }
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const limit = options?.limit || 30;

  try {
    // Try Gateway-side search
    const result = await gatewayClient.request("messenger.search", {
      query: trimmed,
      channelId: options?.channelId,
      limit,
    }) as { results: SearchResult[] };

    return result.results || [];
  } catch {
    // Gateway doesn't support search — fall back to local
    return localSearch(trimmed, options?.channelId, limit);
  }
}

/**
 * Local in-memory search across cached messages.
 */
function localSearch(
  query: string,
  channelId?: string,
  limit = 30
): SearchResult[] {
  const store = useMessengerStore.getState();
  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];

  const channelIds = channelId
    ? [channelId]
    : Object.keys(store.messagesByChannel);

  for (const chId of channelIds) {
    const messages = store.messagesByChannel[chId] || [];
    const channel = store.channels.find((c) => c.id === chId);
    const channelName = channel?.name || "unknown";

    for (const msg of messages) {
      if (results.length >= limit) break;

      const lowerContent = msg.content.toLowerCase();
      const matchIndex = lowerContent.indexOf(lowerQuery);

      if (matchIndex !== -1) {
        // Build a snippet around the match
        const start = Math.max(0, matchIndex - 40);
        const end = Math.min(msg.content.length, matchIndex + query.length + 40);
        let snippet = msg.content.slice(start, end);
        if (start > 0) snippet = "..." + snippet;
        if (end < msg.content.length) snippet = snippet + "...";

        results.push({
          message: msg,
          channelName,
          matchSnippet: snippet,
        });
      }
    }
  }

  // Sort by recency
  results.sort(
    (a, b) => new Date(b.message.createdAt).getTime() - new Date(a.message.createdAt).getTime()
  );

  return results.slice(0, limit);
}
