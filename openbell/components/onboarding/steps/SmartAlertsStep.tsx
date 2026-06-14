import React from "react";
import { StyleSheet, View, Text } from "react-native";
import { Colors } from "@/components/onboarding/theme";
import { Typography } from "@/components/onboarding/theme";
import { Spacing } from "@/components/onboarding/theme";
import { Button } from "@/components/onboarding/ui/Button";
import { Card, CardContent } from "@/components/onboarding/ui/Card";
import { InfoBox } from "@/components/onboarding/ui/InfoBox";
import { 
  TrendingUp, 
  BarChart2, 
  Rocket, 
  Check, 
  Info 
} from "lucide-react-native";

interface SmartAlertsStepProps {
  onNext: () => void;
  onBack: () => void;
}

const SmartAlertsStep: React.FC<SmartAlertsStepProps> = ({
  onNext,
  onBack,
}) => {
  return (
    <View style={styles.container}>
      <Text style={[Typography.h2, styles.title]}>
        Stay Updated with Smart Alerts
      </Text>
      <Text style={[Typography.body1, styles.subtitle]}>
        Be the first to know when:
      </Text>

      <View style={styles.alertsContainer}>
        <Card style={styles.alertCard}>
          <CardContent style={styles.alertContent}>
            <View style={[styles.iconContainer, styles.trendingIconContainer]}>
              <TrendingUp size={24} color={Colors.error} />
            </View>
            <View style={styles.alertTextContainer}>
              <Text style={Typography.subtitle1}>Market trends shift</Text>
              <Text style={styles.alertDescription}>
                Get notified of significant market movements
              </Text>
            </View>
            <Check size={20} color={Colors.success} />
          </CardContent>
        </Card>

        <Card style={styles.alertCard}>
          <CardContent style={styles.alertContent}>
            <View style={[styles.iconContainer, styles.chartIconContainer]}>
              <BarChart2 size={24} color={Colors.primary} />
            </View>
            <View style={styles.alertTextContainer}>
              <Text style={Typography.subtitle1}>
                Your selected assets hit key price levels
              </Text>
              <Text style={styles.alertDescription}>
                Track important price thresholds
              </Text>
            </View>
            <Check size={20} color={Colors.success} />
          </CardContent>
        </Card>

        <Card style={styles.alertCard}>
          <CardContent style={styles.alertContent}>
            <View style={[styles.iconContainer, styles.rocketIconContainer]}>
              <Rocket size={24} color={Colors.secondary} />
            </View>
            <View style={styles.alertTextContainer}>
              <Text style={Typography.subtitle1}>Social sentiment spikes</Text>
              <Text style={styles.alertDescription}>
                Discover assets gaining social attention
              </Text>
            </View>
            <Check size={20} color={Colors.success} />
          </CardContent>
        </Card>
      </View>

      <Button
        title="Enable Alerts (Recommended)"
        onPress={onNext}
        style={styles.enableButton}
        fullWidth
      />

      <Button
        title="Skip for now"
        variant="outline"
        onPress={onNext}
        style={styles.skipButton}
        fullWidth
      />

      <InfoBox
        message="Keeps you connected to the app via push notifications."
        type="info"
        icon={<Info size={20} color={Colors.info} />}
        style={styles.infoBox}
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
  alertsContainer: {
    marginBottom: Spacing.xl,
  },
  alertCard: {
    marginBottom: Spacing.md,
  },
  alertContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  trendingIconContainer: {
    backgroundColor: Colors.error + "15",
  },
  chartIconContainer: {
    backgroundColor: Colors.primaryLight,
  },
  rocketIconContainer: {
    backgroundColor: Colors.secondary + "15",
  },
  alertTextContainer: {
    flex: 1,
  },
  alertDescription: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  enableButton: {
    marginBottom: Spacing.md,
  },
  skipButton: {
    marginBottom: Spacing.xl,
  },
  infoBox: {
    marginBottom: Spacing.xl,
  },
  navigationContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
});

export default SmartAlertsStep;