import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { RoutingMode } from "@/types/recall";

interface Props {
  value: RoutingMode;
  onChange: (mode: RoutingMode) => void;
}

const OPTIONS: Array<{ mode: RoutingMode; label: string; hint: string }> = [
  { mode: "gateway", label: "Gateway", hint: "Action items, summaries, Q&A" },
  { mode: "inference", label: "Inference", hint: "Slides, sentiment, annotations" },
  { mode: "both", label: "Both", hint: "Full meeting intelligence" },
];

export function RoutingModeSelector({ value, onChange }: Props) {
  const { theme } = useThemeStore();

  return (
    <View>
      <View style={styles.segmented}>
        {OPTIONS.map(({ mode, label }) => {
          const active = value === mode;
          return (
            <TouchableOpacity
              key={mode}
              style={[
                styles.segment,
                { borderColor: theme.border },
                active && { backgroundColor: theme.primary + "20", borderColor: theme.primary },
              ]}
              onPress={() => onChange(mode)}
            >
              <Text style={[styles.segmentLabel, { color: active ? theme.primary : theme.textSecondary }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: theme.textTertiary }]}>
        {OPTIONS.find((o) => o.mode === value)?.hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: "row",
    gap: 8,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  hint: {
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
  },
});
