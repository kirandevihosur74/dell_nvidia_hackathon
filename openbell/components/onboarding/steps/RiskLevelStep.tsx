import React from "react";
import { StyleSheet, View, Text } from "react-native";
import { Colors } from "@/components/onboarding/theme";
import { Typography } from "@/components/onboarding/theme";
import { Spacing } from "@/components/onboarding/theme";
import { Button } from "@/components/onboarding/ui/Button";
import { SelectableCard } from "@/components/onboarding/ui/SelectableCard";
import { InfoBox } from "@/components/onboarding/ui/InfoBox";
import { useOnboardingStore, RiskLevel } from "@/stores/onboardingFlowStore";
import { Shield, BarChart2, Rocket, Info } from "lucide-react-native";

interface RiskLevelStepProps {
  onNext: () => void;
  onBack: () => void;
}

const RiskLevelStep: React.FC<RiskLevelStepProps> = ({ onNext, onBack }) => {
  const { riskLevel, setRiskLevel } = useOnboardingStore();

  return (
    <View style={styles.container}>
      <Text style={[Typography.h2, styles.title]}>
        What's Your Risk Comfort Level?
      </Text>
      <Text style={[Typography.body1, styles.subtitle]}>
        Select what matches your investing style
      </Text>

      <View style={styles.optionsContainer}>
        <SelectableCard
          title="Conservative"
          description="Low-Risk, Long-Term Investing"
          icon={<Shield size={24} color={Colors.success} />}
          selected={riskLevel === "conservative"}
          onPress={() => setRiskLevel("conservative")}
          style={styles.optionCard}
        />

        <SelectableCard
          title="Moderate"
          description="Some Risk, Strategic Growth"
          icon={<BarChart2 size={24} color={Colors.primary} />}
          selected={riskLevel === "moderate"}
          onPress={() => setRiskLevel("moderate")}
          style={styles.optionCard}
        />

        <SelectableCard
          title="Aggressive"
          description="High Risk, Short-Term Trading"
          icon={<Rocket size={24} color={Colors.error} />}
          selected={riskLevel === "aggressive"}
          onPress={() => setRiskLevel("aggressive")}
          style={styles.optionCard}
        />
      </View>

      <InfoBox
        message="Determines initial trading suggestions & educational path."
        type="info"
        icon={<Info size={20} color={Colors.info} />}
        style={styles.infoBox}
      />

      <View style={styles.navigationContainer}>
        <Button title="Back" variant="outline" onPress={onBack} />
        <Button title="Continue" onPress={onNext} disabled={!riskLevel} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.md,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  optionsContainer: {
    marginBottom: Spacing.xl,
  },
  optionCard: {
    marginBottom: Spacing.md,
  },
  infoBox: {
    marginBottom: Spacing.xl,
  },
  navigationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export default RiskLevelStep;