// ─── Slack Service ───────────────────────────────────────────────────────────
// Orchestrates Slack integration: OAuth flow, workspace management,
// channel discovery, bridging, and event handling.
// Uses direct HTTP calls to the StreamIO backend instead of Gateway WebSocket.

import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as crypto from "expo-crypto";
import { useSlackStore } from "@/stores/slackStore";
import { useMessengerStore } from "@/stores/messengerStore";
import { SlackConfig } from "@/constants/slack/config";
import * as slackApi from "./slackApi";
import type {
  SlackWorkspace,
  SlackBridge,
  SlackOAuthResult,
} from "@/types/slack";

// ─── OAuth Flow ──────────────────────────────────────────────────────────────

/**
 * Initiate Slack OAuth.
 * 1. Build the Slack OAuth URL client-side (only needs client_id)
 * 2. Open it in an in-app browser
 * 3. Slack redirects to our backend, which exchanges the code for tokens
 * 4. Backend redirects back to the mobile app with workspace data
 */
export async function connectWorkspace(): Promise<SlackOAuthResult> {
  const store = useSlackStore.getState();
  store.setOAuthInProgress(true);
  store.setOAuthError(null);

  try {
    // Generate a CSRF state token
    const state = crypto.randomUUID();

    // Build the Slack OAuth URL directly (no server round-trip needed)
    const params = new URLSearchParams({
      client_id: SlackConfig.clientId,
      scope: SlackConfig.botScopes,
      redirect_uri: SlackConfig.redirectUri,
      state,
    });
    const authUrl = `${SlackConfig.authorizeUrl}?${params.toString()}`;

    // The redirect URI that WebBrowser will listen for (our app's deep link)
    const appCallbackUrl = Linking.createURL("slack/callback");

    // Open the Slack OAuth page in an in-app browser.
    // Flow: Slack → backend callback → redirect to app deep link
    const browserResult = await WebBrowser.openAuthSessionAsync(
      authUrl,
      appCallbackUrl
    );

    if (browserResult.type !== "success" || !browserResult.url) {
      store.setOAuthInProgress(false);
      return { success: false, error: "OAuth was cancelled" };
    }

    // Parse the callback URL from our backend's redirect
    const callbackUrl = Linking.parse(browserResult.url);
    const queryParams = callbackUrl.queryParams || {};

    // Check for errors
    if (queryParams.error) {
      const errorMsg = String(queryParams.error);
      store.setOAuthInProgress(false);
      store.setOAuthError(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Verify CSRF state
    if (queryParams.state && queryParams.state !== state) {
      store.setOAuthInProgress(false);
      store.setOAuthError("OAuth state mismatch");
      return { success: false, error: "OAuth state mismatch — possible CSRF" };
    }

    // Parse workspace data from the redirect
    if (queryParams.success && queryParams.workspace) {
      const workspace: SlackWorkspace = JSON.parse(
        String(queryParams.workspace)
      );
      store.addWorkspace(workspace);
      store.setOAuthInProgress(false);
      return { success: true, workspace };
    }

    store.setOAuthInProgress(false);
    return { success: false, error: "Unexpected callback format" };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "OAuth failed";
    store.setOAuthInProgress(false);
    store.setOAuthError(errorMsg);
    return { success: false, error: errorMsg };
  }
}

// ─── Workspace Management ────────────────────────────────────────────────────

export async function fetchWorkspaces(): Promise<void> {
  try {
    const workspaces = await slackApi.fetchWorkspaces();
    useSlackStore.getState().setWorkspaces(workspaces);
  } catch (err) {
    console.warn("[slack] fetchWorkspaces failed:", err);
  }
}

export async function disconnectWorkspace(teamId: string): Promise<void> {
  try {
    await slackApi.disconnectWorkspace(teamId);
    useSlackStore.getState().removeWorkspace(teamId);
  } catch (err) {
    console.warn("[slack] disconnectWorkspace failed:", err);
  }
}

// ─── Channel Discovery ──────────────────────────────────────────────────────

export async function fetchSlackChannels(
  teamId: string,
  loadMore = false
): Promise<void> {
  const store = useSlackStore.getState();
  if (!loadMore) store.clearAvailableChannels();
  store.setIsLoadingChannels(true);

  try {
    const cursor = loadMore ? store.channelCursor : undefined;
    const result = await slackApi.fetchChannels(teamId, cursor || undefined);

    if (loadMore) {
      store.appendAvailableChannels(result.channels || []);
    } else {
      store.setAvailableChannels(result.channels || []);
    }
    store.setChannelCursor(result.nextCursor || null);
  } catch (err) {
    console.warn("[slack] fetchSlackChannels failed:", err);
  } finally {
    store.setIsLoadingChannels(false);
  }
}

// ─── Bridging ────────────────────────────────────────────────────────────────

export async function bridgeChannel(
  slackChannelId: string,
  slackTeamId: string,
  options?: {
    syncDirection?: "bidirectional" | "slack_to_messenger" | "messenger_to_slack";
    syncReactions?: boolean;
    syncThreads?: boolean;
    syncFiles?: boolean;
  }
): Promise<SlackBridge | null> {
  try {
    const result = await slackApi.createBridge(
      slackChannelId,
      slackTeamId,
      options
    );
    useSlackStore.getState().addBridge(result.bridge);
    useMessengerStore.getState().addChannel(result.channel);
    return result.bridge;
  } catch (err) {
    console.warn("[slack] bridgeChannel failed:", err);
    return null;
  }
}

export async function unbridgeChannel(
  messengerChannelId: string
): Promise<void> {
  try {
    await slackApi.removeBridge(messengerChannelId);
    useSlackStore.getState().removeBridge(messengerChannelId);
  } catch (err) {
    console.warn("[slack] unbridgeChannel failed:", err);
  }
}

export async function fetchBridges(): Promise<void> {
  try {
    const bridges = await slackApi.fetchBridges();
    useSlackStore.getState().setBridges(bridges);
  } catch (err) {
    console.warn("[slack] fetchBridges failed:", err);
  }
}

// ─── Sync ────────────────────────────────────────────────────────────────────

export async function syncChannelHistory(
  messengerChannelId: string,
  limit = 100
): Promise<void> {
  try {
    await slackApi.syncHistory(messengerChannelId, limit);
  } catch (err) {
    console.warn("[slack] syncChannelHistory failed:", err);
  }
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function fetchSlackUsers(teamId: string): Promise<void> {
  try {
    const users = await slackApi.fetchUsers(teamId);
    useSlackStore.getState().setSlackUsers(users);
  } catch (err) {
    console.warn("[slack] fetchSlackUsers failed:", err);
  }
}
