// ─── Slack REST API Client ───────────────────────────────────────────────────
// HTTP client for Slack endpoints on the StreamIO backend.
// Replaces the previous Gateway WebSocket protocol for Slack operations.

import { SlackConfig } from '@/constants/slack/config';
import type {
  SlackWorkspace,
  SlackChannel,
  SlackBridge,
  SlackUserMapping,
} from '@/types/slack';
import type { MessengerChannel } from '@/types/messenger';

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

// ─── Workspaces ─────────────────────────────────────────────────────────────

export async function fetchWorkspaces(): Promise<SlackWorkspace[]> {
  const data = await request<{ workspaces: SlackWorkspace[] }>(
    SlackConfig.api.workspaces,
  );
  return data.workspaces || [];
}

export async function disconnectWorkspace(teamId: string): Promise<void> {
  await request(`${SlackConfig.api.workspaces}/${teamId}`, {
    method: 'DELETE',
  });
}

// ─── Channels ───────────────────────────────────────────────────────────────

export async function fetchChannels(
  teamId: string,
  cursor?: string,
): Promise<{ channels: SlackChannel[]; nextCursor?: string }> {
  const url = new URL(SlackConfig.api.channels(teamId));
  if (cursor) url.searchParams.set('cursor', cursor);
  return request(url.toString());
}

// ─── Bridges ────────────────────────────────────────────────────────────────

export async function fetchBridges(): Promise<SlackBridge[]> {
  const data = await request<{ bridges: SlackBridge[] }>(
    SlackConfig.api.bridges,
  );
  return data.bridges || [];
}

export async function createBridge(
  slackChannelId: string,
  slackTeamId: string,
  options?: {
    syncDirection?: 'bidirectional' | 'slack_to_messenger' | 'messenger_to_slack';
    syncReactions?: boolean;
    syncThreads?: boolean;
    syncFiles?: boolean;
  },
): Promise<{ bridge: SlackBridge; channel: MessengerChannel }> {
  return request(SlackConfig.api.bridges, {
    method: 'POST',
    body: JSON.stringify({ slackChannelId, slackTeamId, ...options }),
  });
}

export async function removeBridge(messengerChannelId: string): Promise<void> {
  await request(SlackConfig.api.bridge(messengerChannelId), {
    method: 'DELETE',
  });
}

// ─── Sync ───────────────────────────────────────────────────────────────────

export async function syncHistory(
  messengerChannelId: string,
  limit = 100,
): Promise<void> {
  await request(SlackConfig.api.syncHistory(messengerChannelId), {
    method: 'POST',
    body: JSON.stringify({ limit }),
  });
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function fetchUsers(teamId: string): Promise<SlackUserMapping[]> {
  const data = await request<{ users: SlackUserMapping[] }>(
    SlackConfig.api.users(teamId),
  );
  return data.users || [];
}
