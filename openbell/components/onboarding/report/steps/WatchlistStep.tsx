import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Check } from "lucide-react-native";
import { Colors, Typography, Spacing } from "@/components/onboarding/theme";
import { Button } from "@/components/onboarding/ui/Button";
import { InfoBox } from "@/components/onboarding/ui/InfoBox";
import { useReportConfigStore } from "@/stores/reportConfigStore";

const PRESET = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL", "META", "NFLX", "AMD", "COIN", "SPY", "QQQ"];

export default function WatchlistStep({ onNext }: { onNext: () => void; onBack: () => void }) {
  const symbols = useReportConfigStore((s) => s.symbols);
  const toggleSymbol = useReportConfigStore((s) => s.toggleSymbol);

  // include any custom symbols already added (e.g. from the Report tab) that aren't presets
  const extras = symbols.filter((s) => !PRESET.includes(s));
  const all = [...PRESET, ...extras];

  return (
    <View style={styles.container}>
      <Text style={styles.lead}>Pick the tickers you want OpenBell to report on.</Text>

      <View style={styles.chips}>
        {all.map((sym) => {
          const on = symbols.includes(sym);
          return (
            <TouchableOpacity
              key={sym}
              activeOpacity={0.7}
              onPress={() => toggleSymbol(sym)}
              style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
            >
              {on && <Check size={14} color="#fff" strokeWidth={3} style={{ marginRight: 5 }} />}
              <Text style={[styles.chipText, { color: on ? "#fff" : Colors.text }]}>{sym}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <InfoBox
        type="info"
        message="You can add more tickers anytime from the Report tab."
        style={{ marginBottom: Spacing.lg }}
      />

      <Button
        title={symbols.length ? `Continue · ${symbols.length} selected` : "Select at least one"}
        variant="primary"
        size="large"
        fullWidth
        disabled={symbols.length === 0}
        onPress={onNext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Spacing.sm },
  lead: { ...Typography.body2, color: Colors.textSecondary, marginBottom: Spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.md },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipOff: { backgroundColor: Colors.white, borderColor: Colors.border },
  chipText: { fontSize: 14, fontWeight: "800", letterSpacing: 0.3 },
});
