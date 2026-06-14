import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import type { EventSubscription } from "expo-modules-core";
import { useRouter } from "expo-router";
import { useGatewayStore } from "@/stores/gatewayStore";
import { gatewayClient, makeIdempotencyKey } from "@/services/gateway";
import { registerForPushNotifications } from "@/services/pushService";
import {
  setupNotificationChannels,
  setupNotificationActions,
  registerPushTokenWithGateway,
  handleGatewayPushMessage,
  clearBadge,
} from "@/services/openclawPushService";
import type { GatewayMessage } from "@/types/gateway";

/**
 * Hook for OpenClaw-specific push notifications.
 *
 * - Registers push token with Gateway on connect
 * - Handles incoming Gateway notification messages (local push)
 * - Handles notification tap → deep link routing
 * - Handles notification actions (reply, snooze, mark done)
 */
export function useOpenClawNotifications() {
  const router = useRouter();
  const { connectionStatus, activeGatewayId } = useGatewayStore();
  const responseListener = useRef<EventSubscription | undefined>(undefined);
  const gatewayMessageUnsub = useRef<(() => void) | null>(null);

  const isDevice = Constants.isDevice;

  // Setup channels and actions once (physical device only)
  useEffect(() => {
    if (!isDevice) return;
    setupNotificationChannels();
    setupNotificationActions();
  }, [isDevice]);

  // Register push token with Gateway when connected
  useEffect(() => {
    if (!isDevice || connectionStatus !== "connected") return;

    registerForPushNotifications().then((token) => {
      if (token) {
        registerPushTokenWithGateway(token);
      }
    });
  }, [connectionStatus, isDevice]);

  // Listen for Gateway notification messages
  useEffect(() => {
    gatewayMessageUnsub.current?.();

    gatewayMessageUnsub.current = gatewayClient.onMessage((msg: GatewayMessage) => {
      handleGatewayPushMessage(msg);
    });

    return () => {
      gatewayMessageUnsub.current?.();
    };
  }, []);

  // Handle notification tap → deep link (physical device only)
  useEffect(() => {
    if (!isDevice) return;
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        const actionId = response.actionIdentifier;

        // Clear badge on any interaction
        clearBadge();

        // Handle actions
        if (actionId === "snooze") {
          // Re-schedule notification in 15 minutes
          const content = response.notification.request.content;
          Notifications.scheduleNotificationAsync({
            content: {
              title: content.title || "ClawMobile.app",
              body: content.body || "",
              data: content.data,
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 15 * 60 },
          });
          return;
        }

        if (actionId === "mark_done" && data?.taskGid) {
          // TODO: Call API to complete task
          return;
        }

        if (actionId === "reply") {
          const replyText = (response as unknown as { userText?: string }).userText;
          if (replyText && data?.sessionId) {
            // Send reply via Gateway
            gatewayClient.request("chat.send", {
              sessionKey: data.sessionId as string,
              message: replyText,
              deliver: false,
              idempotencyKey: makeIdempotencyKey(),
            }).catch(() => {});
          }
          // Navigate to OpenClaw chat
          router.push("/(tabs)/openclaw");
          return;
        }

        // Default navigation based on data
        if (data?.source === "openclaw") {
          if (data.sessionId) {
            router.push("/(tabs)/openclaw");
          } else if (data.taskGid) {
            router.push("/(tabs)/board");
          } else {
            router.push("/(tabs)/openclaw");
          }
        } else if (data?.conversationId) {
          router.push(`/chat/${data.conversationId as string}`);
        } else if (data?.screen === "board") {
          router.push("/(tabs)/board");
        } else if (data?.screen === "activity") {
          router.push("/(tabs)/activity");
        }
      }
    );

    return () => {
      responseListener.current?.remove();
    };
  }, [router, isDevice]);

  // Clear badge when app comes to foreground with OpenClaw tab active
  useEffect(() => {
    if (isDevice && connectionStatus === "connected") {
      clearBadge();
    }
  }, [connectionStatus, isDevice]);
}
