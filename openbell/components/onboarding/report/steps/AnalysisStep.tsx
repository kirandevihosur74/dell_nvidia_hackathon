import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { TrendingUp, Landmark, LineChart } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Colors, Typography, Spacing } from "@/components/onboarding/theme";
import { Button } from "@/components/onboarding/ui/Button";
import { SelectableCard } from "@/components/onboarding/ui/SelectableCard";
import { GROUPS, groupMetricKeys } from "@/constants/reportModel";
import { useReportConfigStore } from "@/stores/reportConfigStore";

const GROUP_ICON: Record<string, LucideIcon> = {
  technical: TrendingUp,
  fundamental: Landmark,
  macro: LineChart,
};

export default function AnalysisStep({ onNext }: { onNext: () => void; onBack: () => void }) {
  const selected = useReportConfigStore((s) => s.selected);
  const toggleGroupBoth = useReportConfigStore((s) => s.toggleGroupBoth);

  const isOn = (groupId: string) => {
    const gk = groupMetricKeys(groupId);
    return gk.length > 0 && gk.every((k) => selected.open.includes(k));
  };
  const anySelected = GROUPS.some((g) => g.modules.some((m) => m.metrics.some((x) => selected.open.includes(`${m.id}.${x.id}`)) ));

  return (
    <View style={styles.container}>
      <Text style={styles.lead}>What should each report cover? Pick the areas to analyze — you can fine-tune individual metrics later in the Report tab.</Text>

      <View style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}>
        {GROUPS.map((g) => {
          const Icon = GROUP_ICON[g.id] ?? TrendingUp;
          const count = groupMetricKeys(g.id).length;
          return (
            <SelectableCard
              key={g.id}
              title={g.label}
              description={`${g.sub} · ${count} metrics`}
              selected={isOn(g.id)}
              onPress={() => toggleGroupBoth(g.id)}
              icon={
                <View style={[styles.iconWrap, { backgroundColor: g.accent.bg }]}>
                  <Icon size={20} color={g.accent.c} strokeWidth={2.2} />
                </View>
              }
            />
          );
        })}
      </View>

      <Button
        title={anySelected ? "Continue" : "Select at least one area"}
        variant="primary"
        size="large"
        fullWidth
        disabled={!anySelected}
        onPress={onNext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Spacing.sm },
  lead: { ...Typography.body2, color: Colors.textSecondary, marginBottom: Spacing.md },
  iconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
