import React from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { Colors } from "@/components/onboarding/theme";
import { Typography } from "@/components/onboarding/theme";
import { Spacing } from "@/components/onboarding/theme";
import { Button } from "@/components/onboarding/ui/Button";
import { InfoBox } from "@/components/onboarding/ui/InfoBox";
import { useOnboardingStore, InvestmentType } from "@/stores/onboardingFlowStore";
import { 
  LineChart, 
  Shield, 
  TrendingUp, 
  BarChart2, 
  Briefcase, 
  Info,
  Check
} from "lucide-react-native";

interface InvestmentTypeStepProps {
  onNext: () => void;
  onBack: () => void;
}

const InvestmentTypeStep: React.FC<InvestmentTypeStepProps> = ({
  onNext,
  onBack,
}) => {
  const { investmentTypes, toggleInvestmentType } = useOnboardingStore();

  const investmentOptions: {
    id: InvestmentType;
    name: string;
    icon: React.ReactNode;
  }[] = [
    { id: "etfs", name: "ETFs", icon: <LineChart size={24} color={Colors.primary} /> },
    { id: "bonds", name: "Bonds", icon: <Shield size={24} color={Colors.primary} /> },
    { id: "crypto", name: "Cryptocurrency", icon: <TrendingUp size={24} color={Colors.primary} /> },
    { id: "options", name: "Options", icon: <BarChart2 size={24} color={Colors.primary} /> },
    { id: "stocks", name: "Stocks", icon: <Briefcase size={24} color={Colors.primary} /> },
    { id: "commodities", name: "Commodities", icon: <LineChart size={24} color={Colors.primary} /> },
    { id: "forex", name: "Forex", icon: <LineChart size={24} color={Colors.primary} /> },

  ];

  return (
    <View style={styles.container}>
      <Text style={[Typography.h2, styles.title]}>
        What Investment Types Interest You?
      </Text>
      <Text style={[Typography.body1, styles.subtitle]}>
        Select all that apply
      </Text>

      <View style={styles.optionsGrid}>
        {investmentOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.optionCard,
              investmentTypes.includes(option.id) && styles.selectedCard,
            ]}
            onPress={() => toggleInvestmentType(option.id)}
            activeOpacity={0.7}
          >
            <View style={styles.optionContent}>
              <View style={styles.iconContainer}>{option.icon}</View>
              <Text style={styles.optionName}>{option.name}</Text>
              {investmentTypes.includes(option.id) && (
                <View style={styles.checkIcon}>
                  <Check size={16} color={Colors.primary} />
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <InfoBox
        message="Based on your selection, we'll personalize UI elements (e.g., showing crypto alerts for crypto traders)."
        type="info"
        icon={<Info size={20} color={Colors.info} />}
        style={styles.infoBox}
      />

      <View style={styles.navigationContainer}>
        <Button title="Back" variant="outline" onPress={onBack} />
        <Button
          title="Continue"
          onPress={onNext}
          disabled={investmentTypes.length === 0}
        />
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
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: Spacing.xl,
  },
  optionCard: {
    width: "48%",
    marginBottom: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    overflow: "hidden",
  },
  selectedCard: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  optionContent: {
    padding: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.white,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  optionName: {
    ...Typography.subtitle2,
    textAlign: "center",
  },
  checkIcon: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  infoBox: {
    marginBottom: Spacing.xl,
  },
  navigationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export default InvestmentTypeStep;