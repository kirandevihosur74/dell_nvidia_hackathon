import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Sunrise, Sunset, ArrowRight, Bell } from "lucide-react-native";
import { Colors, Typography, Spacing } from "@/components/onboarding/theme";
import { Button } from "@/components/onboarding/ui/Button";

export default function WelcomeStep({ onNext }: { onNext: () => void }) {
  const features = [
    "Pick a watchlist of tickers",
    "Choose what to analyze — technicals, fundamentals, macro",
    "Opening Bell & Closing Bell reports, on your schedule",
    "Pushed to you for approval before the bell",
  ];
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#7C2D12", "#F59E0B"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroIcons}>
          <Sunrise size={40} color="#fff" strokeWidth={2.2} />
          <Sunset size={40} color="#fff" strokeWidth={2.2} />
        </View>
        <Text style={styles.heroTitle}>OpenBell</Text>
        <Text style={styles.heroSub}>Scheduled market reports, before & after the bell</Text>
      </LinearGradient>

      <Text style={[Typography.h2, styles.title]}>Let's build your report</Text>
      <Text style={styles.lead}>
        A few quick steps and OpenBell will deliver a tailored market briefing on your schedule.
      </Text>

      <View style={styles.features}>
        {features.map((f) => (
          <View key={f} style={styles.featureItem}>
            <View style={styles.dot} />
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      <Button
        title="Get Started"
        variant="primary"
        size="large"
        fullWidth
        icon={<ArrowRight size={20} color={Colors.white} />}
        iconPosition="right"
        onPress={onNext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Spacing.lg },
  hero: {
    borderRadius: 20,
    padding: Spacing.lg,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  heroIcons: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.sm },
  heroTitle: { fontSize: 30, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  heroSub: { fontSize: 14, fontWeight: "500", color: "rgba(255,255,255,0.9)", textAlign: "center", marginTop: 4 },
  title: { textAlign: "center", marginBottom: Spacing.xs },
  lead: { ...Typography.body2, color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.lg, paddingHorizontal: Spacing.md },
  features: { marginBottom: Spacing.xl, paddingHorizontal: Spacing.sm },
  featureItem: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginRight: Spacing.sm },
  featureText: { ...Typography.body2, color: Colors.text, flex: 1 },
});
