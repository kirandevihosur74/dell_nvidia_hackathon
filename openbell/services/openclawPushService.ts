import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { gatewayClient } from "@/services/gateway";
import { e2eService } from "@/services/encryption";
import type { GatewayMessage } from "@/types/gateway";
import {
  CATEGORY_META,
  DEFAULT_PREFS,
  PREFS_KEY,
  loadPreferences,
  savePreferences,
  isQuietHours,
  type NotificationCategory,
  type NotificationPreferences,
} from "./openclawPushPrefs";

// Re-export types and data so existing imports still work
export { CATEGORY_META, loadPreferences, savePreferences };
export type { NotificationCategory, NotificationPreferences };

// --- Setup ---

/**
 * Configure notification channels for OpenClaw on Android.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("openclaw-tasks", {
    name: "Task Updates",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    description: "Notifications about task changes from your ClawMobile.app agent",
  });

  await Notifications.setNotificationChannelAsync("openclaw-reminders", {
    name: "Reminders",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    description: "Reminders from your ClawMobile.app agent",
  });

  await Notifications.setNotificationChannelAsync("openclaw-alerts", {
    name: "Alerts",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
    description: "Critical alerts from your ClawMobile.app agent",
  });

  await Notifications.setNotificationChannelAsync("openclaw-agent", {
    name: "Agent Messages",
    importance: Notifications.AndroidImportance.DEFAULT,
    description: "Messages from your ClawMobile.app agent",
  });
}

// --- Notification Actions ---

/**
 * Configure interactive notification actions.
 */
export async function setupNotificationActions(): Promise<void> {
  await Notifications.setNotificationCategoryAsync("openclaw-actionable", [
    {
      identifier: "reply",
      buttonTitle: "Reply",
      textInput: {
        submitButtonTitle: "Send",
        placeholder: "Type a reply...",
      },
    },
    {
      identifier: "snooze",
      buttonTitle: "Snooze 15m",
    },
    {
      identifier: "mark_done",
      buttonTitle: "Mark Done",
      options: { isDestructive: false },
    },
  ]);
}

// --- Gateway Push Registration ---

/**
 * Register the push token with the OpenClaw Gateway for remote notifications.
 */
export function registerPushTokenWithGateway(token: string): void {
  gatewayClient.send({
    type: "chat" as const,
    id: `push_register_${Date.now()}`,
    payload: {
      type: "push_register",
      token,
      platform: Platform.OS,
      categories: Object.keys(CATEGORY_META),
    },
  });
}

// --- Local Notification Dispatch ---

/**
 * Show a local notification from a Gateway push event.
 * Used when the app receives a push via WebSocket while foregrounded.
 */
export async function showLocalNotification(
  title: string,
  body: string,
  category: NotificationCategory,
  data?: Record<string, unknown>
): Promise<void> {
  const prefs = await loadPreferences();

  if (!prefs.enabled) return;
  if (!prefs.categories[category]) return;
  if (isQuietHours(prefs)) return;

  const channelId =
    category === "alert" ? "openclaw-alerts" :
    category === "reminder" ? "openclaw-reminders" :
    category === "task_update" || category === "delegation_result" ? "openclaw-tasks" :
    "openclaw-agent";

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { ...data, category, source: "openclaw" },
      categoryIdentifier: "openclaw-actionable",
      ...(Platform.OS === "android" ? { channelId } : {}),
    },
    trigger: null, // Show immediately
  });
}

// --- Gateway Message Handler ---

/**
 * Handle incoming push-type messages from the Gateway WebSocket.
 */
export function handleGatewayPushMessage(msg: GatewayMessage): boolean {
  const payload = msg.payload;
  if (!payload || payload.type !== "notification") return false;

  const title = (payload.title as string) || "ClawMobile.app";
  const body = (payload.body as string) || "";
  const category = (payload.category as NotificationCategory) || "agent_response";
  const data = (payload.data as Record<string, unknown>) || {};

  showLocalNotification(title, body, category, data);
  return true;
}

// --- Encrypted Push Payloads ---

/**
 * Decrypt an encrypted push notification payload.
 */
export async function decryptPushPayload(
  gatewayId: string,
  encryptedBody: string
): Promise<{ title: string; body: string; data?: Record<string, unknown> } | null> {
  try {
    const decrypted = await e2eService.decryptFromStorage(gatewayId, encryptedBody);
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

// --- Badge Management ---

/**
 * Set the app badge count.
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear the app badge.
 */
export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

