import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Check, ArrowRight, Sunrise, Sunset } from "lucide-react-native";
import { Colors, Typography, Spacing } from "@/components/onboarding/theme";
import { Button } from "@/components/onboarding/ui/Button";
import { REPORTS } from "@/constants/reportModel";
import { useReportConfigStore } from "@/stores/reportConfigStore";

export default function CompletionStep({ onComplete }: { onComplete: () => void; onBack: () => void }) {
  const { symbols, selected, enabled, freq } = useReportConfigStore();

  const enabledIds = (["open", "close"] as const).filter((id) => enabled[id]);
  const metricsTotal = new Set([...selected.open, ...selected.close]).size;

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Check size={40} color="#fff" strokeWidth={3} />
      </View>
      <Text style={[Typography.h2, styles.title]}>You're all set!</Text>
      <Text style={styles.lead}>
        Here's your OpenBell setup. You can fine-tune anything in the Report tab.
      </Text>

      <View style={styles.summary}>
        <SummaryRow label="Watchlist" value={`${symbols.length} ticker${symbols.length === 1 ? "" : "s"}`} />
        <SummaryRow label="Metrics tracked" value={`${metricsTotal}`} />
        <SummaryRow
          label="Reports"
          value={enabledIds.length ? enabledIds.map((id) => REPORTS[id].name).join(" + ") : "None"}
        />
      </View>

      <View style={{ gap: Spacing.sm, marginBottom: Spacing.xl }}>
        {enabledIds.map((id) => {
          const r = REPORTS[id];
          const Icon = id === "open" ? Sunrise : Sunset;
          return (
            <LinearGradient
              key={id}
              colors={r.band}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.reportPill}
            >
              <Icon size={18} color="#fff" strokeWidth={2.3} />
              <Text style={styles.reportPillText}>{r.name}</Text>
              <Text style={styles.reportPillMeta}>{freq[id]} · {r.time} ET</Text>
            </LinearGradient>
          );
        })}
      </View>

      <Button
        title="Open my reports"
        variant="primary"
        size="large"
        fullWidth
        icon={<ArrowRight size={20} color={Colors.white} />}
        iconPosition="right"
        onPress={onComplete}
      />
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Spacing.lg, alignItems: "stretch" },
  badge: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: { textAlign: "center", marginBottom: Spacing.xs },
  lead: { ...Typography.body2, color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.lg, paddingHorizontal: Spacing.md },
  summary: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.card,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  summaryLabel: { ...Typography.body2, color: Colors.textSecondary },
  summaryValue: { ...Typography.subtitle2, color: Colors.text },
  reportPill: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, borderRadius: 12, paddingVertical: 12, paddingHorizontal: Spacing.md },
  reportPillText: { color: "#fff", fontWeight: "800", fontSize: 15, flex: 1 },
  reportPillMeta: { color: "rgba(255,255,255,0.9)", fontWeight: "600", fontSize: 12 },
});
