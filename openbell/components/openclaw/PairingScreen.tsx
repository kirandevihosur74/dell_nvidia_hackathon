import { View, Text, TextInput, TouchableOpacity, Platform } from "react-native";
import { useState } from "react";
import { Link, ShieldCheck, Keyboard, Terminal } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";

interface PairingScreenProps {
  code: string | null;
  direction: "display" | "enter" | null;
  onSubmitCode: (code: string) => void;
  onCancel: () => void;
  onRetry?: () => void;
}

export function PairingScreen({ code, direction, onSubmitCode, onCancel, onRetry }: PairingScreenProps) {
  const { theme } = useThemeStore();
  const [inputCode, setInputCode] = useState("");

  if (direction === "display" && code) {
    // Gateway wants us to display this code — user confirms on the Gateway device
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32, backgroundColor: theme.background }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.primaryLight + "20", justifyContent: "center", alignItems: "center", marginBottom: 24 }}>
          <ShieldCheck size={40} color={theme.primary} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: "700", color: theme.text, marginBottom: 8, textAlign: "center" }}>
          Pairing Code
        </Text>
        <Text style={{ fontSize: 14, color: theme.textSecondary, textAlign: "center", marginBottom: 32 }}>
          Enter this code on your Gateway device to pair
        </Text>
        <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 24, borderWidth: 2, borderColor: theme.primary, marginBottom: 32 }}>
          <Text style={{ fontSize: 36, fontWeight: "800", color: theme.text, letterSpacing: 8, textAlign: "center", fontVariant: ["tabular-nums"] }}>
            {code}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: theme.textTertiary, textAlign: "center" }}>
          Waiting for confirmation...
        </Text>
        <TouchableOpacity onPress={onCancel} style={{ marginTop: 24 }}>
          <Text style={{ fontSize: 14, color: theme.error }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (direction === "enter" && !code) {
    // "pairing required" — new device needs approval on the gateway
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32, backgroundColor: theme.background }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.primaryLight + "20", justifyContent: "center", alignItems: "center", marginBottom: 24 }}>
          <Terminal size={40} color={theme.primary} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: "700", color: theme.text, marginBottom: 8, textAlign: "center" }}>
          Device Approval Required
        </Text>
        <Text style={{ fontSize: 14, color: theme.textSecondary, textAlign: "center", marginBottom: 24, lineHeight: 20 }}>
          This device needs to be approved on your gateway. Run this command on your gateway machine:
        </Text>
        <View style={{ backgroundColor: theme.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 8, width: "100%" }}>
          <Text style={{ fontSize: 13, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", color: theme.text, textAlign: "center" }}>
            openclaw devices approve
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: theme.textTertiary, textAlign: "center", marginBottom: 32 }}>
          Or run "openclaw devices list" to see pending requests
        </Text>
        {onRetry && (
          <TouchableOpacity
            onPress={onRetry}
            style={{
              backgroundColor: theme.primary,
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 12,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>Retry Connection</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onCancel}>
          <Text style={{ fontSize: 14, color: theme.error }}>Disconnect</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // direction === "enter" with code — user needs to type the code shown on the Gateway
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32, backgroundColor: theme.background }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.primaryLight + "20", justifyContent: "center", alignItems: "center", marginBottom: 24 }}>
        <Keyboard size={40} color={theme.primary} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: "700", color: theme.text, marginBottom: 8, textAlign: "center" }}>
        Enter Pairing Code
      </Text>
      <Text style={{ fontSize: 14, color: theme.textSecondary, textAlign: "center", marginBottom: 32 }}>
        Check your Gateway for the pairing code
      </Text>
      <TextInput
        value={inputCode}
        onChangeText={setInputCode}
        placeholder="000000"
        placeholderTextColor={theme.textTertiary}
        keyboardType="number-pad"
        maxLength={6}
        style={{
          fontSize: 32,
          fontWeight: "700",
          color: theme.text,
          backgroundColor: theme.card,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: theme.border,
          paddingHorizontal: 32,
          paddingVertical: 16,
          textAlign: "center",
          letterSpacing: 8,
          width: 240,
          marginBottom: 24,
          fontVariant: ["tabular-nums"],
        }}
      />
      <TouchableOpacity
        onPress={() => {
          if (inputCode.length >= 4) onSubmitCode(inputCode);
        }}
        style={{
          backgroundColor: inputCode.length >= 4 ? theme.primary : theme.border,
          paddingHorizontal: 32,
          paddingVertical: 14,
          borderRadius: 12,
          marginBottom: 16,
        }}
        disabled={inputCode.length < 4}
      >
        <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>Pair Device</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancel}>
        <Text style={{ fontSize: 14, color: theme.error }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}
