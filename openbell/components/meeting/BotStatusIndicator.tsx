import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Video, VideoOff, Monitor, LogIn, LogOut } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { PlatformBadge } from "./PlatformBadge";
import type { BotStatus, MeetingPlatform, RoutingMode, ParticipantEvent } from "@/types/recall";

interface Props {
  status: BotStatus;
  platform: MeetingPlatform | null;
  routingMode: RoutingMode;
  duration: number;
  transcriptLineCount: number;
  pendingActionItems: number;
  error: string | null;
  onRemove: () => void;
  participantEvents?: ParticipantEvent[];
  activeSpeaker?: string | null;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  creating: { color: "#EAB308", label: "Deploying..." },
  joining: { color: "#EAB308", label: "Joining meeting..." },
  in_waiting_room: { color: "#F97316", label: "Waiting to be admitted" },
  recording: { color: "#22C55E", label: "Meeting active" },
  done: { color: "#6B7280", label: "Meeting ended" },
  error: { color: "#EF4444", label: "Error" },
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function BotStatusIndicator({
  status,
  platform,
  routingMode,
  duration,
  transcriptLineCount,
  pendingActionItems,
  error,
  onRemove,
  participantEvents = [],
  activeSpeaker,
}: Props) {
  const { theme } = useThemeStore();
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.error;
  const canRemove = status === "joining" || status === "recording" || status === "in_waiting_room";

  // Derive current participant states from events
  const participantStates = useMemo(() => {
    const states: Record<number, { name: string; camera: boolean; screenshare: boolean; present: boolean }> = {};
    for (const evt of participantEvents) {
      if (evt.type === "speech_on" || evt.type === "speech_off") continue;
      const pid = evt.participant.id;
      if (!states[pid]) states[pid] = { name: evt.participant.name || `P${pid}`, camera: false, screenshare: false, present: false };
      if (evt.type === "join") states[pid].present = true;
      if (evt.type === "leave") states[pid].present = false;
      if (evt.type === "webcam_on") states[pid].camera = true;
      if (evt.type === "webcam_off") states[pid].camera = false;
      if (evt.type === "screenshare_on") states[pid].screenshare = true;
      if (evt.type === "screenshare_off") states[pid].screenshare = false;
    }
    return Object.values(states).filter((s) => s.present);
  }, [participantEvents]);

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: config.color }]} />
          <Text style={[styles.statusLabel, { color: theme.text }]}>{config.label}</Text>
          {platform && <PlatformBadge platform={platform} size="small" />}
        </View>
        {canRemove && (
          <TouchableOpacity onPress={onRemove} style={[styles.removeBtn, { borderColor: theme.border }]}>
            <Text style={[styles.removeBtnText, { color: "#EF4444" }]}>Remove</Text>
          </TouchableOpacity>
        )}
      </View>

      {status === "recording" && (
        <View style={styles.statsRow}>
          <Text style={[styles.stat, { color: theme.textSecondary }]}>
            {formatDuration(duration)}
          </Text>
          <Text style={[styles.stat, { color: theme.textSecondary }]}>
            {transcriptLineCount} lines
          </Text>
          <Text style={[styles.stat, { color: theme.textSecondary }]}>
            ~${(duration / 3600 * 0.65).toFixed(2)}
          </Text>
          <Text style={[styles.stat, { color: theme.textSecondary }]}>
            {routingMode}
          </Text>
          {pendingActionItems > 0 && (
            <View style={[styles.actionBadge, { backgroundColor: theme.primary + "20" }]}>
              <Text style={[styles.actionBadgeText, { color: theme.primary }]}>
                {pendingActionItems} action items
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Option 2: Participant status icon strip */}
      {status === "recording" && participantStates.length > 0 && (
        <View style={styles.iconStrip}>
          {participantStates.map((p, i) => (
            <View key={i} style={styles.participantIcons}>
              <Text style={[styles.participantName, { color: theme.textSecondary }]} numberOfLines={1}>
                {p.name.split(" ")[0]}
              </Text>
              {p.camera ? (
                <Video size={11} color="#3B82F6" />
              ) : (
                <VideoOff size={11} color="#6B7280" />
              )}
              {p.screenshare && <Monitor size={11} color="#8B5CF6" />}
            </View>
          ))}
        </View>
      )}

      {/* Active speaker inline */}
      {status === "recording" && activeSpeaker && (
        <View style={styles.activeSpeakerRow}>
          <View style={styles.speakerDot} />
          <Text style={[styles.activeSpeakerText, { color: theme.text }]} numberOfLines={1}>
            {activeSpeaker} is speaking
          </Text>
        </View>
      )}

      {error && (
        <Text style={[styles.errorText, { color: "#EF4444" }]} numberOfLines={2}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stat: {
    fontSize: 12,
  },
  actionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  iconStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  participantIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  participantName: {
    fontSize: 11,
    maxWidth: 60,
  },
  activeSpeakerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  speakerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  activeSpeakerText: {
    fontSize: 12,
    fontWeight: "500",
  },
  errorText: {
    fontSize: 12,
  },
});
