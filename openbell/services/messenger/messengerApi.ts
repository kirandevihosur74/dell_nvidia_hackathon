// ─── Messenger REST API Client ───────────────────────────────────────────────
// HTTP client for messenger endpoints on the StreamIO backend.
// Used for data-fetching operations (channels, users, messages).
// Real-time operations (typing, presence, message events) stay on WebSocket.

import { StreamIOAPIConfig } from '@/constants/streamio/config';
import type {
  MessengerChannel,
  MessengerMessage,
  MessengerUser,
} from '@/types/messenger';

const BASE = StreamIOAPIConfig.baseURL;

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(body || `HTTP ${resp.status}`);
  }
  return resp.json();
}

// ─── Channels ───────────────────────────────────────────────────────────────

export async function fetchChannels(): Promise<MessengerChannel[]> {
  const data = await request<{ channels: MessengerChannel[] }>(
    `${BASE}${StreamIOAPIConfig.endpoints.messengerChannels}`,
  );
  return data.channels || [];
}

export async function createChannel(
  name: string,
  type: string = 'public',
  description?: string,
): Promise<MessengerChannel> {
  const data = await request<{ channel: MessengerChannel }>(
    `${BASE}${StreamIOAPIConfig.endpoints.messengerChannels}`,
    {
      method: 'POST',
      body: JSON.stringify({ name, type, description }),
    },
  );
  return data.channel;
}

// ─── Messages ───────────────────────────────────────────────────────────────

export async function fetchMessages(
  channelId: string,
  cursor?: string,
  limit = 50,
): Promise<{ messages: MessengerMessage[]; hasMore: boolean }> {
  const url = new URL(`${BASE}${StreamIOAPIConfig.endpoints.messengerMessages}`);
  url.searchParams.set('channelId', channelId);
  if (cursor) url.searchParams.set('cursor', cursor);
  url.searchParams.set('limit', String(limit));
  return request(url.toString());
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function fetchUsers(): Promise<{
  users: MessengerUser[];
  currentUserId: string;
}> {
  return request(`${BASE}${StreamIOAPIConfig.endpoints.messengerUsers}`);
}

// ─── Threads ────────────────────────────────────────────────────────────────

export async function fetchThreadReplies(
  parentMessageId: string,
): Promise<MessengerMessage[]> {
  const data = await request<{ messages: MessengerMessage[] }>(
    `${BASE}${StreamIOAPIConfig.endpoints.messengerThreads}/${parentMessageId}`,
  );
  return data.messages || [];
}

// ─── DMs ────────────────────────────────────────────────────────────────────

export async function createDM(
  userIds: string[],
): Promise<MessengerChannel> {
  const data = await request<{ channel: MessengerChannel }>(
    `${BASE}${StreamIOAPIConfig.endpoints.messengerDMs}`,
    {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    },
  );
  return data.channel;
}
