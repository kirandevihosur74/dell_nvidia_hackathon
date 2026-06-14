import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useThemeStore } from "@/stores/themeStore";
import type { SpeakingStats } from "@/types/recall";

interface Props {
  stats: SpeakingStats;
}

const SPEAKER_COLORS = [
  "#3B82F6", "#22C55E", "#EAB308", "#F97316", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F43F5E", "#14B8A6", "#A855F7",
];

export function SpeakingTimeChart({ stats }: Props) {
  const { theme } = useThemeStore();
  const [expanded, setExpanded] = useState(false);

  const entries = Object.entries(stats).sort(([, a], [, b]) => b.totalSeconds - a.totalSeconds);
  if (entries.length === 0) return null;

  const maxSeconds = Math.max(...entries.map(([, s]) => s.totalSeconds), 1);

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.header}>
        <Feather name="bar-chart-2" size={14} color={theme.textSecondary} />
        <Text style={[styles.title, { color: theme.text }]}>Speaking Time</Text>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={theme.textSecondary} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.chartBody}>
          {entries.map(([name, stat], i) => {
            const barWidth = Math.max((stat.totalSeconds / maxSeconds) * 100, 2);
            const color = SPEAKER_COLORS[i % SPEAKER_COLORS.length];
            const minutes = Math.floor(stat.totalSeconds / 60);
            const seconds = Math.round(stat.totalSeconds % 60);
            const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

            return (
              <View key={name} style={styles.row}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {name}
                </Text>
                <View style={styles.barContainer}>
                  <View style={[styles.bar, { width: `${barWidth}%`, backgroundColor: color }]}>
                    {stat.isActive && <View style={styles.activeDot} />}
                  </View>
                </View>
                <Text style={[styles.pct, { color: theme.textSecondary }]}>
                  {stat.percentage}%
                </Text>
                <Text style={[styles.time, { color: theme.textSecondary }]}>
                  {timeStr}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 6,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  chartBody: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    width: 80,
    fontSize: 12,
    fontWeight: "500",
  },
  barContainer: {
    flex: 1,
    height: 14,
    backgroundColor: "rgba(128,128,128,0.1)",
    borderRadius: 7,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  pct: {
    width: 36,
    fontSize: 11,
    textAlign: "right",
  },
  time: {
    width: 44,
    fontSize: 11,
    textAlign: "right",
  },
});
