import "../global.css";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import Constants from "expo-constants";

// Suppress known Expo Go simulator errors
LogBox.ignoreLogs(["NativeJSLogger", "[runtime not ready]", "addListener"]);

// Prevent red screen for NativeJSLogger error (Expo Go simulator issue)
if (typeof ErrorUtils !== "undefined") {
  const originalHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    const msg = error?.message || String(error);
    if (msg.includes("NativeJSLogger") || msg.includes("addListener")) return;
    if (originalHandler) originalHandler(error, isFatal);
  });
}
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useThemeStore } from "@/stores/themeStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import Toast from "@/components/notifications/Toast";
import { CommandPaletteFAB } from "@/components/CommandPaletteFAB";
import { decodeQRPayload, toGatewayConfig } from "@/services/gateway/qrPairing";
import { pairingService } from "@/services/gateway/pairingService";
import { useGatewayStore } from "@/stores/gatewayStore";

// Lazy-load notification hooks to avoid importing expo-notifications on simulator
// where the native module (NativeJSLogger) is unavailable
let useNotifications: () => void = () => {};
let useOpenClawNotifications: () => void = () => {};
if (Constants.isDevice) {
  useNotifications = require("@/hooks/useNotifications").useNotifications;
  useOpenClawNotifications = require("@/hooks/useOpenClawNotifications").useOpenClawNotifications;
}

export default function RootLayout() {
  const router = useRouter();
  const { mode, loadPersisted: loadTheme } = useThemeStore();
  const { ready, loadState } = useOnboardingStore();
  const { loadNerveUrl } = useSettingsStore();
  const { addGateway, setActiveGateway, setApprovalStatus } = useGatewayStore();

  // Initialize offline sync and push notifications
  useOfflineSync();
  useNotifications();
  useOpenClawNotifications();

  useEffect(() => {
    loadState();
    loadTheme();
    loadNerveUrl();
  }, [loadState, loadTheme]);

  // Handle deep links: asana-copilot://gateway?url=...&token=...
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      if (!url) return;

      const parsed = Linking.parse(url);
      if (parsed.hostname !== "gateway" && parsed.path !== "gateway") return;

      // Re-encode as deep link for the parser
      const result = decodeQRPayload(url);
      if (!result.success) return;

      const config = toGatewayConfig(result.payload);
      addGateway(config);
      setActiveGateway(config.id);
      setApprovalStatus("pending");
      await pairingService.saveGateway(config);

      router.push("/scan-gateway");
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);

    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => subscription.remove();
  }, [router, addGateway, setActiveGateway, setApprovalStatus]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <OfflineBanner />
      <Toast />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scan-gateway" options={{ presentation: "fullScreenModal" }} />
        <Stack.Screen name="chat/[conversationId]" options={{ presentation: "card" }} />
        <Stack.Screen name="openclaw/encryption" options={{ presentation: "card" }} />
        <Stack.Screen name="openclaw/notifications" options={{ presentation: "card" }} />
      </Stack>
      <CommandPaletteFAB />
    </GestureHandlerRootView>
  );
}
