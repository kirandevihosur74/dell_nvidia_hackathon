import { View, Text, TouchableOpacity, Alert } from "react-native";
import { ShieldCheck, Copy, Check } from "lucide-react-native";
import { useState } from "react";
import * as Clipboard from "expo-clipboard";
import { useThemeStore } from "@/stores/themeStore";

interface KeyVerificationProps {
  gatewayName: string;
  safetyNumberBlocks: string[];
  isVerified: boolean;
  onVerify: () => void;
  onClose: () => void;
}

export function KeyVerification({
  gatewayName,
  safetyNumberBlocks,
  isVerified,
  onVerify,
  onClose,
}: KeyVerificationProps) {
  const { theme } = useThemeStore();
  const [copied, setCopied] = useState(false);

  const fullFingerprint = safetyNumberBlocks.join(" ");

  const handleCopy = async () => {
    await Clipboard.setStringAsync(fullFingerprint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = () => {
    Alert.alert(
      "Verify Encryption",
      "Have you confirmed this safety number matches what's shown on your Gateway device?",
      [
        { text: "Not Yet", style: "cancel" },
        {
          text: "Yes, It Matches",
          onPress: onVerify,
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, padding: 24, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ alignItems: "center", gap: 12, marginBottom: 32 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: isVerified ? theme.success + "20" : theme.primary + "20",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ShieldCheck size={36} color={isVerified ? theme.success : theme.primary} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: "700", color: theme.text, textAlign: "center" }}>
          {isVerified ? "Encryption Verified" : "Verify Encryption"}
        </Text>
        <Text style={{ fontSize: 14, color: theme.textSecondary, textAlign: "center", lineHeight: 20 }}>
          {isVerified
            ? `Your connection to "${gatewayName}" is verified end-to-end encrypted.`
            : `Compare this safety number with the one shown on "${gatewayName}" to verify your connection is secure.`}
        </Text>
      </View>

      {/* Safety Number Grid */}
      <View
        style={{
          backgroundColor: theme.card,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: isVerified ? theme.success : theme.border,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
          {safetyNumberBlocks.map((block, index) => (
            <View
              key={index}
              style={{
                width: "22%",
                alignItems: "center",
                paddingVertical: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: theme.text,
                  fontVariant: ["tabular-nums"],
                  letterSpacing: 1,
                }}
              >
                {block}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Copy button */}
      <TouchableOpacity
        onPress={handleCopy}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingVertical: 12,
          marginBottom: 16,
        }}
      >
        {copied ? <Check size={16} color={theme.success} /> : <Copy size={16} color={theme.primary} />}
        <Text style={{ fontSize: 14, color: copied ? theme.success : theme.primary, fontWeight: "500" }}>
          {copied ? "Copied!" : "Copy Safety Number"}
        </Text>
      </TouchableOpacity>

      {/* Actions */}
      {!isVerified && (
        <TouchableOpacity
          onPress={handleVerify}
          style={{
            backgroundColor: theme.primary,
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>
            Mark as Verified
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={onClose}
        style={{
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: "center",
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.border,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "600", color: theme.textSecondary }}>
          {isVerified ? "Done" : "Verify Later"}
        </Text>
      </TouchableOpacity>

      {/* Info text */}
      <Text style={{ fontSize: 12, color: theme.textTertiary, textAlign: "center", marginTop: 16, lineHeight: 18 }}>
        If the numbers don't match, your connection may have been intercepted. Disconnect and re-pair your device.
      </Text>
    </View>
  );
}
