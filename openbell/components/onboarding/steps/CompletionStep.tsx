import React from "react";
import { StyleSheet, View, Text } from "react-native";
import { Colors } from "@/components/onboarding/theme";
import { Typography } from "@/components/onboarding/theme";
import { Spacing } from "@/components/onboarding/theme";
import { Button } from "@/components/onboarding/ui/Button";
import { Card, CardContent } from "@/components/onboarding/ui/Card";
import { useOnboardingStore } from "@/stores/onboardingFlowStore";
import { ArrowRight } from "lucide-react-native";

interface CompletionStepProps {
  onComplete: () => void;
  onBack: () => void;
}

const CompletionStep: React.FC<CompletionStepProps> = ({
  onComplete,
  onBack,
}) => {
  const {
    investmentGoal,
    riskLevel,
    investmentTypes,
    selectedStrategy,
    notificationPreferences,
    followedInfluencers,
    followedAnalysts,
  } = useOnboardingStore();

  const getGoalText = () => {
    switch (investmentGoal) {
      case "generate":
        return "Generate Investment Options";
      case "house":
        return "Save for a House";
      case "wedding":
        return "Save for a Wedding";
      case "learning":
        return "Financial Understanding";
      default:
        return "Not specified";
    }
  };

  const getRiskText = () => {
    switch (riskLevel) {
      case "conservative":
        return "Conservative";
      case "moderate":
        return "Moderate";
      case "aggressive":
        return "Aggressive";
      default:
        return "Not specified";
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[Typography.h2, styles.title]}>You're Ready to Start!</Text>
      <Text style={[Typography.body1, styles.subtitle]}>
        Your trading journey begins now.
      </Text>

      <Card style={styles.summaryCard}>
        <CardContent>
          <Text style={[Typography.h3, styles.summaryTitle]}>
            Your Profile Summary
          </Text>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Trading Goal:</Text>
            <Text style={styles.summaryValue}>{getGoalText()}</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Risk Level:</Text>
            <Text style={styles.summaryValue}>{getRiskText()}</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Interests:</Text>
            <Text style={styles.summaryValue}>
              {investmentTypes.length > 0
                ? investmentTypes.join(", ")
                : "Not specified"}
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Strategy:</Text>
            <Text style={styles.summaryValue}>
              {selectedStrategy?.name || "Customized"}
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Notifications:</Text>
            <Text style={styles.summaryValue}>
              {notificationPreferences.frequency}
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Following:</Text>
            <Text style={styles.summaryValue}>
              {followedInfluencers.length} influencers, {followedAnalysts.length}{" "}
              analysts
            </Text>
          </View>
        </CardContent>
      </Card>

      <Button
        title="Go to Dashboard"
        onPress={onComplete}
        icon={<ArrowRight size={20} color={Colors.white} />}
        iconPosition="right"
        style={styles.dashboardButton}
        fullWidth
      />

      <View style={styles.navigationContainer}>
        <Button title="Back" variant="outline" onPress={onBack} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  summaryCard: {
    marginBottom: Spacing.xl,
    backgroundColor: Colors.primaryLight,
  },
  summaryTitle: {
    marginBottom: Spacing.md,
  },
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryLabel: {
    ...Typography.body1,
    color: Colors.textSecondary,
  },
  summaryValue: {
    ...Typography.body1,
    fontWeight: "600",
  },
  dashboardButton: {
    marginBottom: Spacing.xl,
    height: 56,
  },
  navigationContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
});

export default CompletionStep;