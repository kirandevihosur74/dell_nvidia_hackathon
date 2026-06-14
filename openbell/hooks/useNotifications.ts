import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import type { EventSubscription } from "expo-modules-core";
import { useRouter } from "expo-router";
import { registerForPushNotifications, registerTokenWithBackend } from "@/services/pushService";

/**
 * Hook that registers for push notifications and handles tap-to-navigate.
 */
export function useNotifications() {
  const router = useRouter();
  const notificationListener = useRef<EventSubscription | undefined>(undefined);
  const responseListener = useRef<EventSubscription | undefined>(undefined);

  useEffect(() => {
    // Skip notification setup on simulator — native module not available
    if (!Constants.isDevice) return;

    // Register for push and send token to backend
    registerForPushNotifications().then((token) => {
      if (token) {
        registerTokenWithBackend(token);
      }
    });

    try {
      // Listen for incoming notifications (foreground)
      notificationListener.current = Notifications.addNotificationReceivedListener(
        (_notification) => {
          // Could update badge count, show in-app toast, etc.
        }
      );

      // Listen for notification taps (background/killed → foreground)
      responseListener.current =
        Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data;

          if (data?.conversationId) {
            router.push(`/chat/${data.conversationId as string}`);
          } else if (data?.screen === "board") {
            router.push("/(tabs)/board");
          } else if (data?.screen === "activity") {
            router.push("/(tabs)/activity");
          } else {
            router.push("/(tabs)/chat");
          }
        });
    } catch {
      // Native notification module not available (simulator)
    }

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);
}
