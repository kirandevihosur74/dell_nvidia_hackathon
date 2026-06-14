import { View, Text, Switch, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";
import { Shield, Key, RotateCcw, Trash2, ChevronLeft, ShieldCheck } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useThemeStore } from "@/stores/themeStore";
import { useEncryptionStore } from "@/stores/encryptionStore";
import { useGatewayStore } from "@/stores/gatewayStore";
import { e2eService, keyManager } from "@/services/encryption";
import { KeyVerification } from "@/components/openclaw/KeyVerification";

export default function EncryptionSettingsScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { enabled, keys, safetyNumberBlocks, isVerified, setEnabled, setKeys, setSafetyNumberBlocks, setIsVerified } = useEncryptionStore();
  const { activeGatewayId, gateways } = useGatewayStore();
  const [showVerification, setShowVerification] = useState(false);

  const activeGateway = gateways.find((g) => g.id === activeGatewayId);

  // Load key info on mount
  useEffect(() => {
    keyManager.getAllKeyInfo().then(setKeys);
  }, [setKeys]);

  // Load safety number when gateway changes
  useEffect(() => {
    if (activeGatewayId) {
      keyManager.generateSafetyNumber(activeGatewayId).then(setSafetyNumberBlocks);
      keyManager.getKeyInfo(activeGatewayId).then((info) => {
        setIsVerified(info?.verified || false);
      });
    }
  }, [activeGatewayId, setSafetyNumberBlocks, setIsVerified]);

  const handleToggleEncryption = useCallback(
    async (value: boolean) => {
      if (value && activeGatewayId) {
        await e2eService.enable(activeGatewayId);
        const allKeys = await keyManager.getAllKeyInfo();
        setKeys(allKeys);
      } else {
        e2eService.disable();
      }
      setEnabled(value);
    },
    [activeGatewayId, setEnabled, setKeys]
  );

  const handleRotateKey = useCallback(async () => {
    if (!activeGatewayId) return;
    Alert.alert(
      "Rotate Key",
      "This will generate a new encryption key. The Gateway must also accept the new key.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Rotate",
          onPress: async () => {
            await keyManager.rotateKey(activeGatewayId);
            const allKeys = await keyManager.getAllKeyInfo();
            setKeys(allKeys);
            const blocks = await keyManager.generateSafetyNumber(activeGatewayId);
            setSafetyNumberBlocks(blocks);
            setIsVerified(false);
          },
        },
      ]
    );
  }, [activeGatewayId, setKeys, setSafetyNumberBlocks, setIsVerified]);

  const handleDeleteKey = useCallback(
    async (gatewayId: string) => {
      Alert.alert("Delete Key", "This will remove encryption for this gateway.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await keyManager.deleteKey(gatewayId);
            const allKeys = await keyManager.getAllKeyInfo();
            setKeys(allKeys);
            if (gatewayId === activeGatewayId) {
              e2eService.disable();
              setEnabled(false);
            }
          },
        },
      ]);
    },
    [activeGatewayId, setKeys, setEnabled]
  );

  const handleVerify = useCallback(async () => {
    if (!activeGatewayId) return;
    await keyManager.markVerified(activeGatewayId);
    setIsVerified(true);
    setShowVerification(false);
  }, [activeGatewayId, setIsVerified]);

  if (showVerification && safetyNumberBlocks && activeGateway) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <KeyVerification
          gatewayName={activeGateway.name}
          safetyNumberBlocks={safetyNumberBlocks}
          isVerified={isVerified}
          onVerify={handleVerify}
          onClose={() => setShowVerification(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text }}>Encryption</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
        {/* Toggle */}
        <View style={{ backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <Shield size={20} color={theme.primary} />
              <View>
                <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>End-to-End Encryption</Text>
                <Text style={{ fontSize: 12, color: theme.textTertiary }}>AES-256-GCM</Text>
              </View>
            </View>
            <Switch value={enabled} onValueChange={handleToggleEncryption} />
          </View>
        </View>

        {/* Active Gateway Key */}
        {activeGateway && enabled && (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 1 }}>
              Active Gateway
            </Text>
            <View style={{ backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 16, gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>{activeGateway.name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isVerified ? theme.success : theme.warning }} />
                  <Text style={{ fontSize: 12, color: isVerified ? theme.success : theme.warning }}>
                    {isVerified ? "Verified" : "Unverified"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setShowVerification(true)}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderRadius: 8, backgroundColor: theme.primary + "10", paddingHorizontal: 12 }}
              >
                <ShieldCheck size={16} color={theme.primary} />
                <Text style={{ fontSize: 14, color: theme.primary, fontWeight: "500" }}>
                  {isVerified ? "View Safety Number" : "Verify Safety Number"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleRotateKey}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderRadius: 8, backgroundColor: theme.background, paddingHorizontal: 12 }}
              >
                <RotateCcw size={16} color={theme.textSecondary} />
                <Text style={{ fontSize: 14, color: theme.textSecondary }}>Rotate Key</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* All Keys */}
        {keys.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 1 }}>
              All Keys ({keys.length})
            </Text>
            <View style={{ backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, overflow: "hidden" }}>
              {keys.map((keyInfo, index) => {
                const gw = gateways.find((g) => g.id === keyInfo.gatewayId);
                return (
                  <View
                    key={keyInfo.gatewayId}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 14,
                      borderBottomWidth: index < keys.length - 1 ? 0.5 : 0,
                      borderBottomColor: theme.border,
                      gap: 10,
                    }}
                  >
                    <Key size={16} color={theme.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: theme.text }}>{gw?.name || keyInfo.gatewayId}</Text>
                      <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                        Created {new Date(keyInfo.createdAt).toLocaleDateString()}
                        {keyInfo.verified ? " · Verified" : ""}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteKey(keyInfo.gatewayId)} hitSlop={8}>
                      <Trash2 size={14} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Info */}
        <View style={{ padding: 16, gap: 8 }}>
          <Text style={{ fontSize: 12, color: theme.textTertiary, lineHeight: 18 }}>
            End-to-end encryption ensures that only you and your Gateway can read your messages. Keys are stored in your device's secure hardware enclave.
          </Text>
          <Text style={{ fontSize: 12, color: theme.textTertiary, lineHeight: 18 }}>
            Verify the safety number with your Gateway device to confirm no one is intercepting your connection.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
