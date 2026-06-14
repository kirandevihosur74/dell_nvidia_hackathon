import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch } from "react-native";
import { Clock } from "lucide-react-native";
import { Colors, Typography, Spacing } from "@/components/onboarding/theme";
import { Button } from "@/components/onboarding/ui/Button";
import { InfoBox } from "@/components/onboarding/ui/InfoBox";
import { REPORTS, type ReportId } from "@/constants/reportModel";
import { useReportConfigStore } from "@/stores/reportConfigStore";

const FREQS = ["Daily", "Weekdays", "Weekly"];

export default function ScheduleStep({ onNext }: { onNext: () => void; onBack: () => void }) {
  const enabled = useReportConfigStore((s) => s.enabled);
  const freq = useReportConfigStore((s) => s.freq);
  const setEnabled = useReportConfigStore((s) => s.setEnabled);
  const setFreq = useReportConfigStore((s) => s.setFreq);

  const ids: ReportId[] = ["open", "close"];
  const anyEnabled = enabled.open || enabled.close;

  return (
    <View style={styles.container}>
      <Text style={styles.lead}>Choose which reports to receive and how often.</Text>

      <View style={{ gap: Spacing.md, marginBottom: Spacing.md }}>
        {ids.map((id) => {
          const r = REPORTS[id];
          const Icon = r.icon;
          const on = enabled[id];
          return (
            <View key={id} style={[styles.card, { borderColor: on ? r.c : Colors.border }]}>
              <View style={styles.cardHead}>
                <View style={[styles.iconWrap, { backgroundColor: r.bg }]}>
                  <Icon size={20} color={r.c} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{r.name}</Text>
                  <Text style={styles.cardSub}>{r.time} ET · {r.fires}</Text>
                </View>
                <Switch
                  value={on}
                  onValueChange={(v) => setEnabled(id, v)}
                  trackColor={{ true: r.c, false: Colors.gray[300] }}
                  thumbColor="#fff"
                />
              </View>

              {on && (
                <View style={styles.freqRow}>
                  {FREQS.map((f) => {
                    const sel = freq[id] === f;
                    return (
                      <TouchableOpacity
                        key={f}
                        activeOpacity={0.7}
                        onPress={() => setFreq(id, f)}
                        style={[styles.freqBtn, { borderColor: sel ? r.c : Colors.border, backgroundColor: sel ? r.bg : "#fff" }]}
                      >
                        <Text style={{ fontSize: 12.5, fontWeight: "700", color: sel ? r.c : Colors.textSecondary }}>{f}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </View>

      <InfoBox
        type="info"
        icon={<Clock size={16} color={Colors.info} />}
        message="Reports fire in market time and are pushed to you for approval."
        style={{ marginBottom: Spacing.lg }}
      />

      <Button
        title={anyEnabled ? "Continue" : "Enable at least one report"}
        variant="primary"
        size="large"
        fullWidth
        disabled={!anyEnabled}
        onPress={onNext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Spacing.sm },
  lead: { ...Typography.body2, color: Colors.textSecondary, marginBottom: Spacing.md },
  card: { borderWidth: 1.5, borderRadius: 14, padding: Spacing.md, backgroundColor: Colors.white },
  cardHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  iconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitle: { ...Typography.subtitle1, color: Colors.text },
  cardSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  freqRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  freqBtn: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 10, borderWidth: 1.5 },
});
