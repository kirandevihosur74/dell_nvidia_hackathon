import React, { useState } from "react";
import { View, Text, StyleSheet, Switch } from "react-native";
import { Bell, Target, CalendarClock, BarChart3, FileBarChart } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Colors, Typography, Spacing } from "@/components/onboarding/theme";
import { Button } from "@/components/onboarding/ui/Button";

type Alert = { id: string; label: string; desc: string; icon: LucideIcon };
const ALERTS: Alert[] = [
  { id: "report", label: "Report ready", desc: "When your Opening/Closing Bell report is generated", icon: FileBarChart },
  { id: "target", label: "Price-target hits", desc: "When a ticker reaches an analyst target", icon: Target },
  { id: "earnings", label: "Earnings reminders", desc: "Before a holding reports earnings", icon: CalendarClock },
  { id: "volume", label: "Unusual volume", desc: "When volume spikes on your watchlist", icon: BarChart3 },
];

export default function AlertsStep({ onNext }: { onNext: () => void; onBack: () => void }) {
  const [on, setOn] = useState<Record<string, boolean>>({ report: true, target: true, earnings: true, volume: false });

  return (
    <View style={styles.container}>
      <View style={styles.heroIcon}>
        <Bell size={28} color={Colors.primary} strokeWidth={2.2} />
      </View>
      <Text style={styles.lead}>Choose when OpenBell should ping you between reports.</Text>

      <View style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}>
        {ALERTS.map((a) => {
          const Icon = a.icon;
          return (
            <View key={a.id} style={styles.row}>
              <View style={styles.iconWrap}>
                <Icon size={18} color={Colors.primary} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{a.label}</Text>
                <Text style={styles.rowDesc}>{a.desc}</Text>
              </View>
              <Switch
                value={!!on[a.id]}
                onValueChange={(v) => setOn((s) => ({ ...s, [a.id]: v }))}
                trackColor={{ true: Colors.primary, false: Colors.gray[300] }}
                thumbColor="#fff"
              />
            </View>
          );
        })}
      </View>

      <Button title="Continue" variant="primary" size="large" fullWidth onPress={onNext} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Spacing.sm },
  heroIcon: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  lead: { ...Typography.body2, color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.md,
    backgroundColor: Colors.white,
  },
  iconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  rowTitle: { ...Typography.subtitle2, color: Colors.text },
  rowDesc: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
});
