import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useThemeStore } from "@/stores/themeStore";
import type { SpeakerTimelineSummary } from "@/types/recall";

interface Props {
  summary: SpeakerTimelineSummary;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function SpeakerSummaryCard({ summary }: Props) {
  const { theme } = useThemeStore();

  const entries = Object.entries(summary.stats).sort(([, a], [, b]) => b.totalSeconds - a.totalSeconds);

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Feather name="users" size={14} color={theme.textSecondary} />
        <Text style={[styles.title, { color: theme.text }]}>Speaker Summary</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {formatDuration(summary.totalDuration)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Duration</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#3B82F6" }]}>
            {summary.dominantSpeaker.split(" ")[0] || "—"}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Most Active</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {Math.round(summary.silencePercentage)}%
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Silence</Text>
        </View>
      </View>

      <View style={styles.breakdown}>
        {entries.map(([name, stat]) => (
          <View key={name} style={styles.breakdownRow}>
            <Text style={[styles.breakdownName, { color: theme.text }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.breakdownValue, { color: theme.textSecondary }]}>
              {formatDuration(stat.totalSeconds)} ({stat.percentage}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  breakdown: {
    gap: 4,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breakdownName: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  breakdownValue: {
    fontSize: 12,
  },
});
