import { useState, useRef, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { AlertCircle, CheckCircle2 } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useGatewayStore } from "@/stores/gatewayStore";
import { useRouter } from "expo-router";
import {
  normalizeCode,
  resolveInviteCode,
  inviteResultToGatewayConfig,
} from "@/services/gateway/inviteCodeService";
import { pairingService } from "@/services/gateway/pairingService";

interface InviteCodeInputProps {
  onClose?: () => void;
}

type InputState =
  | { step: "input" }
  | { step: "resolving" }
  | { step: "error"; message: string };

export function InviteCodeInput({ onClose }: InviteCodeInputProps) {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { addGateway, setActiveGateway, setApprovalStatus } = useGatewayStore();

  const [code, setCode] = useState("");
  const [state, setState] = useState<InputState>({ step: "input" });
  const inputRef = useRef<TextInput>(null);

  const handleCodeChange = useCallback((text: string) => {
    // Only allow alphanumeric + dash, max 9 chars (CLAW-XXXX)
    const filtered = text.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 9);
    setCode(filtered);

    // Auto-submit when full code entered
    const normalized = normalizeCode(filtered);
    if (/^CLAW-[A-Z0-9]{4}$/.test(normalized) && filtered.length >= 4) {
      handleSubmit(normalized);
    }
  }, []);

  const handleSubmit = useCallback(async (normalizedCode?: string) => {
    const toResolve = normalizedCode || normalizeCode(code);

    if (!/^CLAW-[A-Z0-9]{4}$/.test(toResolve)) {
      setState({ step: "error", message: "Enter a 4-character code (e.g., CLAW-7X9K)" });
      return;
    }

    setState({ step: "resolving" });

    const result = await resolveInviteCode(toResolve);

    if (!result.success) {
      setState({ step: "error", message: result.error.message });
      return;
    }

    // Create gateway config from resolved invite
    const config = inviteResultToGatewayConfig(result.result);

    // Save and connect
    addGateway(config);
    setActiveGateway(config.id);
    setApprovalStatus("pending");
    await pairingService.saveGateway(config);

    // Navigate to scan-gateway screen which handles the approval waiting state
    onClose?.();
    router.push("/scan-gateway");
  }, [code, addGateway, setActiveGateway, setApprovalStatus, onClose, router]);

  const handleRetry = () => {
    setCode("");
    setState({ step: "input" });
    inputRef.current?.focus();
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.textTertiary }]}>
        INVITE CODE
      </Text>

      <View style={styles.inputRow}>
        <Text style={[styles.prefix, { color: theme.textTertiary }]}>CLAW-</Text>
        <TextInput
          ref={inputRef}
          value={code.replace(/^CLAW-?/, "")}
          onChangeText={(text) => handleCodeChange(`CLAW-${text}`)}
          placeholder="XXXX"
          placeholderTextColor={theme.textTertiary}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={4}
          editable={state.step === "input" || state.step === "error"}
          style={[
            styles.input,
            {
              backgroundColor: theme.card,
              color: theme.text,
              borderColor: state.step === "error" ? "#FF3B30" : theme.border,
            },
          ]}
        />
      </View>

      {state.step === "resolving" && (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.statusText, { color: theme.textTertiary }]}>
            Looking up code...
          </Text>
        </View>
      )}

      {state.step === "error" && (
        <View style={styles.statusRow}>
          <AlertCircle size={16} color="#FF3B30" />
          <Text style={[styles.statusText, { color: "#FF3B30" }]}>
            {state.message}
          </Text>
        </View>
      )}

      {state.step === "error" && (
        <TouchableOpacity onPress={handleRetry} style={{ marginTop: 8 }}>
          <Text style={[styles.retryText, { color: theme.primary }]}>Try again</Text>
        </TouchableOpacity>
      )}

      {state.step === "input" && code.length === 0 && (
        <Text style={[styles.hint, { color: theme.textTertiary }]}>
          Ask the Gateway owner to run: clawd invite
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  prefix: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  input: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "monospace",
    letterSpacing: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    textAlign: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  statusText: {
    fontSize: 13,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
  },
  hint: {
    fontSize: 13,
    marginTop: 4,
  },
});
