// ─── Slack OAuth Configuration ───────────────────────────────────────────────
// Client-side config for Slack OAuth. The client secret stays on the backend.

import { StreamIOAPIConfig } from '@/constants/streamio/config';

export const SlackConfig = {
  clientId: '10623076053110.10743708878501',

  // Scopes requested during OAuth
  botScopes: [
    'channels:read',
    'channels:history',
    'chat:write',
    'users:read',
    'reactions:read',
    'files:read',
  ].join(','),

  // Backend handles the OAuth callback and token exchange
  redirectUri: `${StreamIOAPIConfig.baseURL}/api/v1/slack/oauth/callback`,

  // Slack OAuth endpoints
  authorizeUrl: 'https://slack.com/oauth/v2/authorize',

  // Backend Slack API endpoints
  api: {
    workspaces: `${StreamIOAPIConfig.baseURL}/api/v1/slack/workspaces`,
    channels: (teamId: string) =>
      `${StreamIOAPIConfig.baseURL}/api/v1/slack/workspaces/${teamId}/channels`,
    bridges: `${StreamIOAPIConfig.baseURL}/api/v1/slack/bridges`,
    bridge: (messengerChannelId: string) =>
      `${StreamIOAPIConfig.baseURL}/api/v1/slack/bridges/${messengerChannelId}`,
    syncHistory: (messengerChannelId: string) =>
      `${StreamIOAPIConfig.baseURL}/api/v1/slack/bridges/${messengerChannelId}/sync`,
    users: (teamId: string) =>
      `${StreamIOAPIConfig.baseURL}/api/v1/slack/workspaces/${teamId}/users`,
  },
};
