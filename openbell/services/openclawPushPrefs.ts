import AsyncStorage from "@react-native-async-storage/async-storage";

// --- Notification Categories ---

export type NotificationCategory =
  | "task_update"
  | "reminder"
  | "alert"
  | "agent_response"
  | "delegation_result";

export interface NotificationPreferences {
  enabled: boolean;
  categories: Record<NotificationCategory, boolean>;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string;   // "07:00"
}

export const PREFS_KEY = "openclaw_notification_prefs";

export const DEFAULT_PREFS: NotificationPreferences = {
  enabled: true,
  categories: {
    task_update: true,
    reminder: true,
    alert: true,
    agent_response: true,
    delegation_result: true,
  },
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
};

// --- Category Metadata ---

export const CATEGORY_META: Record<NotificationCategory, { label: string; description: string; icon: string }> = {
  task_update: { label: "Task Updates", description: "Build finished, PR merged, deploy complete", icon: "check-circle" },
  reminder: { label: "Reminders", description: "Meeting in 10 min, follow up on email", icon: "clock" },
  alert: { label: "Alerts", description: "Server CPU spike, CI pipeline failed", icon: "alert-triangle" },
  agent_response: { label: "Agent Responses", description: "Agent finished a long-running request", icon: "message-square" },
  delegation_result: { label: "Delegation Results", description: "Delegated task completed by agent", icon: "zap" },
};

// --- Preferences ---

export async function loadPreferences(): Promise<NotificationPreferences> {
  try {
    const json = await AsyncStorage.getItem(PREFS_KEY);
    return json ? { ...DEFAULT_PREFS, ...JSON.parse(json) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePreferences(prefs: NotificationPreferences): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

// --- Quiet Hours ---

export function isQuietHours(prefs: NotificationPreferences): boolean {
  if (!prefs.quietHoursEnabled) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = prefs.quietHoursStart.split(":").map(Number);
  const [endH, endM] = prefs.quietHoursEnd.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}
