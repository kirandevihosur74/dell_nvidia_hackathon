// ─── Messenger Notifications ─────────────────────────────────────────────────
// Push notification integration for Messenger events.
// Sends local notifications for messages in non-active channels and
// registers push token with the Gateway for remote delivery.

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { gatewayClient } from "@/services/gateway/gatewayClient";
import { useMessengerStore } from "@/stores/messengerStore";
import type { MessengerMessage } from "@/types/messenger";
import type { GatewayMessage } from "@/types/gateway";

// ─── Channel Notification Preferences ────────────────────────────────────────

const mutedChannels = new Set<string>();

export function muteChannel(channelId: string) {
  mutedChannels.add(channelId);
}

export function unmuteChannel(channelId: string) {
  mutedChannels.delete(channelId);
}

export function isChannelMuted(channelId: string): boolean {
  return mutedChannels.has(channelId);
}

// ─── Android Notification Channel ────────────────────────────────────────────

let channelCreated = false;

async function ensureNotificationChannel() {
  if (channelCreated || Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("messenger", {
      name: "Messenger",
      description: "Messages from channels and DMs",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
      enableVibrate: true,
    });
    channelCreated = true;
  } catch {
    // ignore — module may not be available
  }
}

// ─── Local Notification ──────────────────────────────────────────────────────

async function showLocalNotification(message: MessengerMessage, channelName: string) {
  try {
    await ensureNotificationChannel();

    const title = message.isAgent
      ? `${message.displayName} (bot) in #${channelName}`
      : `${message.displayName} in #${channelName}`;

    const body = message.content.length > 120
      ? message.content.slice(0, 120) + "..."
      : message.content;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type: "messenger",
          channelId: message.channelId,
          threadId: message.threadId,
          messageId: message.id,
        },
        ...(Platform.OS === "android" ? { channelId: "messenger" } : {}),
      },
      trigger: null, // immediate
    });
  } catch {
    // Notification module may not be available
  }
}

// ─── Event Handler ───────────────────────────────────────────────────────────

let unsubscribe: (() => void) | null = null;

function handleMessengerNotification(msg: GatewayMessage) {
  if (msg.type !== ("messenger:message:new" as string)) return;

  const payload = msg.payload as Record<string, unknown>;
  const message = payload?.message as MessengerMessage;
  if (!message) return;

  const store = useMessengerStore.getState();

  // Don't notify for own messages
  if (message.userId === store.currentUserId) return;

  // Don't notify for the active channel
  if (message.channelId === store.activeChannelId) return;

  // Don't notify for muted channels
  if (mutedChannels.has(message.channelId)) return;

  // Find channel name for the notification title
  const channel = store.channels.find((c) => c.id === message.channelId);
  const channelName = channel?.name || "messenger";

  showLocalNotification(message, channelName);
}

export function startNotificationListener() {
  if (unsubscribe) return;
  unsubscribe = gatewayClient.onMessage(handleMessengerNotification);
}

export function stopNotificationListener() {
  unsubscribe?.();
  unsubscribe = null;
}

// ─── Push Token Registration ─────────────────────────────────────────────────

/**
 * Register the device's push token with the Gateway so it can deliver
 * remote notifications when the app is backgrounded.
 */
export async function registerPushTokenWithGateway(): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    await gatewayClient.request("messenger.push.register", {
      token,
      platform: Platform.OS,
    });
  } catch {
    // Best-effort — will retry on next connect
  }
}

// ─── Notification Tap Handler ────────────────────────────────────────────────

/**
 * Set up a listener for notification taps to deep-link to the channel/thread.
 * Returns a cleanup function.
 */
export function setupNotificationTapHandler(
  onNavigate: (channelId: string, threadId?: string) => void
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data;
      if (data?.type === "messenger" && data.channelId) {
        onNavigate(
          data.channelId as string,
          data.threadId as string | undefined
        );
      }
    }
  );

  return () => subscription.remove();
}
