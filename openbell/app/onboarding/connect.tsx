import { View, Text, TouchableOpacity, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useThemeStore } from "@/stores/themeStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { InviteCodeInput } from "@/components/gateway/InviteCodeInput";
import { DiscoveredGateways } from "@/components/gateway/DiscoveredGateways";
import { MyGateways } from "@/components/gateway/MyGateways";
import { useGatewayStore } from "@/stores/gatewayStore";
import { pairingService } from "@/services/gateway/pairingService";
import { QrCode, Keyboard, Settings2, Zap } from "lucide-react-native";
import type { GatewayConfig } from "@/types/gateway";

export default function WelcomeScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { skip } = useOnboardingStore();
  const { addGateway, setActiveGateway, setApprovalStatus } = useGatewayStore();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleSkip = () => {
    skip();
    router.replace("/(tabs)/openclaw");
  };

  const handleScanQR = () => {
    router.push("/scan-gateway");
  };

  const [showInviteCode, setShowInviteCode] = useState(false);

  const handleManualSetup = () => {
    skip();
    router.replace("/(tabs)/openclaw");
  };

  const handleDiscoveredConnect = async (config: GatewayConfig) => {
    addGateway(config);
    setActiveGateway(config.id);
    setApprovalStatus("pending");
    await pairingService.saveGateway(config);
    skip();
    router.replace("/(tabs)/openclaw");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, paddingHorizontal: 24 }}>
        {/* Skip button */}
        <TouchableOpacity onPress={handleSkip} style={{ alignSelf: "flex-end", paddingVertical: 12 }}>
          <Text style={{ fontSize: 15, color: theme.textTertiary }}>Skip</Text>
        </TouchableOpacity>

        <Animated.View style={{ flex: 1, justifyContent: "center", opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Hero */}
          <View style={{ alignItems: "center", marginBottom: 48 }}>
            <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Zap size={36} color="#FFFFFF" />
            </View>
            <Text style={{ fontSize: 28, fontWeight: "700", color: theme.text }}>ClawMobile</Text>
            <Text style={{ fontSize: 15, color: theme.textTertiary, marginTop: 8, textAlign: "center" }}>
              Connect to your OpenClaw Gateway to start chatting with your AI agents.
            </Text>
          </View>

          {/* Auto-Discovered Gateways + Cloud-Linked Gateways */}
          <DiscoveredGateways onConnect={handleDiscoveredConnect} />
          <MyGateways onConnect={handleDiscoveredConnect} />

          {/* Connection Options */}
          <View style={{ gap: 12 }}>
            {/* Primary: Scan QR Code */}
            <TouchableOpacity
              onPress={handleScanQR}
              style={{
                backgroundColor: theme.primary,
                borderRadius: 14,
                paddingVertical: 18,
                paddingHorizontal: 20,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                <QrCode size={24} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>Scan QR Code</Text>
                <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>
                  Scan the code from your Gateway dashboard
                </Text>
              </View>
            </TouchableOpacity>

            {/* Secondary: Enter Invite Code */}
            {showInviteCode ? (
              <View style={{
                backgroundColor: theme.card,
                borderRadius: 14,
                padding: 20,
                borderWidth: 1,
                borderColor: theme.border,
              }}>
                <InviteCodeInput onClose={() => setShowInviteCode(false)} />
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowInviteCode(true)}
                style={{
                  backgroundColor: theme.card,
                  borderRadius: 14,
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
                  <Keyboard size={22} color={theme.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>Enter Invite Code</Text>
                  <Text style={{ fontSize: 13, color: theme.textTertiary, marginTop: 2 }}>
                    Type the code from your Gateway terminal
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Tertiary: Manual Setup */}
            <TouchableOpacity
              onPress={handleManualSetup}
              style={{
                backgroundColor: theme.card,
                borderRadius: 14,
                paddingVertical: 16,
                paddingHorizontal: 20,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
                <Settings2 size={22} color={theme.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>Manual Setup</Text>
                <Text style={{ fontSize: 13, color: theme.textTertiary, marginTop: 2 }}>
                  Enter gateway host, port, and credentials
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* How it works hint */}
        <View style={{ alignItems: "center", marginBottom: 16 }}>
          <Text style={{ fontSize: 13, color: theme.textTertiary, textAlign: "center", lineHeight: 18 }}>
            Run your OpenClaw Gateway, then use "Scan QR Code"{"\n"}to connect in seconds.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
