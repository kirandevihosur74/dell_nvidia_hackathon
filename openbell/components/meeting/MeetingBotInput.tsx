import React, { useState, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { Bot, AlertTriangle } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useStreamIOAuthStore } from "@/stores/streamio/authStore";
import { PlatformBadge } from "./PlatformBadge";
import { RoutingModeSelector } from "./RoutingModeSelector";
import { detectPlatform, isValidMeetingUrl } from "@/services/recall/recallService";
import type { RoutingMode, MeetingPlatform } from "@/types/recall";

interface Props {
  onDeploy: (meetingUrl: string, routingMode: RoutingMode) => void;
  isDeploying: boolean;
}

export function MeetingBotInput({ onDeploy, isDeploying }: Props) {
  const { theme } = useThemeStore();
  const isAuthenticated = useStreamIOAuthStore((s) => s.isAuthenticated);
  const [url, setUrl] = useState("");
  const [routingMode, setRoutingMode] = useState<RoutingMode>("gateway");

  const detectedPlatform: MeetingPlatform | null = useMemo(() => {
    if (!url.trim()) return null;
    const p = detectPlatform(url.trim());
    return p !== "unknown" ? p : null;
  }, [url]);

  const isValid = useMemo(() => isValidMeetingUrl(url.trim()), [url]);

  const handleDeploy = () => {
    if (!isValid) {
      Alert.alert("Invalid URL", "Please paste a valid Zoom, Google Meet, Teams, Webex, or Slack Huddle URL.");
      return;
    }
    Alert.alert(
      "Deploy Meeting Bot",
      `Deploy bot to this ${detectedPlatform} meeting?\n\n~$0.65/hr for recording + transcription`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Deploy", onPress: () => onDeploy(url.trim(), routingMode) },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Bot size={16} color={theme.primary} />
        <Text style={[styles.title, { color: theme.text }]}>Meeting Bot</Text>
      </View>

      {!isAuthenticated && (
        <View style={[styles.authWarning, { backgroundColor: "#F59E0B20" }]}>
          <AlertTriangle size={14} color="#F59E0B" />
          <Text style={[styles.authWarningText, { color: "#F59E0B" }]}>
            Sign in via Settings → StreamIO to deploy meeting bots
          </Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
          placeholder="Paste meeting URL (Zoom, Meet, Teams...)"
          placeholderTextColor={theme.textTertiary}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        {detectedPlatform && <PlatformBadge platform={detectedPlatform} size="small" />}
      </View>

      <RoutingModeSelector value={routingMode} onChange={setRoutingMode} />

      <TouchableOpacity
        style={[styles.deployBtn, { backgroundColor: isValid && isAuthenticated ? theme.primary : theme.border }]}
        onPress={handleDeploy}
        disabled={!isValid || isDeploying || !isAuthenticated}
      >
        <Text style={[styles.deployBtnText, { color: isValid ? "#FFFFFF" : theme.textTertiary }]}>
          {isDeploying ? "Deploying..." : "Deploy Bot"}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.costHint, { color: theme.textTertiary }]}>
        ~$0.65/hr for meeting intelligence
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  deployBtn: {
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  deployBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  costHint: {
    fontSize: 11,
    textAlign: "center",
  },
  authWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: 8,
  },
  authWarningText: {
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
});
