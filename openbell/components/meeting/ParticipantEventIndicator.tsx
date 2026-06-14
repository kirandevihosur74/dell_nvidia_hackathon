import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useThemeStore } from "@/stores/themeStore";
import type { ParticipantEventType } from "@/types/recall";

interface Props {
  type: ParticipantEventType;
  participantName: string | null;
  timestamp: string;
}

const EVENT_CONFIG: Record<string, { icon: string; label: (name: string) => string; color: string }> = {
  join: { icon: "log-in", label: (n) => `${n} joined`, color: "#22C55E" },
  leave: { icon: "log-out", label: (n) => `${n} left`, color: "#6B7280" },
  webcam_on: { icon: "video", label: (n) => `${n} camera on`, color: "#3B82F6" },
  webcam_off: { icon: "video-off", label: (n) => `${n} camera off`, color: "#6B7280" },
  screenshare_on: { icon: "monitor", label: (n) => `${n} started sharing`, color: "#8B5CF6" },
  screenshare_off: { icon: "monitor", label: (n) => `${n} stopped sharing`, color: "#6B7280" },
};

export function ParticipantEventIndicator({ type, participantName, timestamp }: Props) {
  const { theme } = useThemeStore();

  // Skip speech events — those are handled by ActiveSpeakerIndicator
  if (type === "speech_on" || type === "speech_off") return null;

  const config = EVENT_CONFIG[type];
  if (!config) return null;

  const name = participantName || "Someone";
  const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <View style={[styles.badge, { backgroundColor: config.color + "15" }]}>
        <Feather name={config.icon as any} size={11} color={config.color} />
        <Text style={[styles.text, { color: theme.textSecondary }]}>
          {config.label(name)}
        </Text>
        {time ? <Text style={[styles.time, { color: theme.textSecondary }]}>{time}</Text> : null}
      </View>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    gap: 6,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(128,128,128,0.2)",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  text: {
    fontSize: 11,
  },
  time: {
    fontSize: 10,
    opacity: 0.6,
  },
});
