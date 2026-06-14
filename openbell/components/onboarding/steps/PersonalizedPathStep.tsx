import React from "react";
import { StyleSheet, View, Text } from "react-native";
import { Colors } from "@/components/onboarding/theme";
import { Typography } from "@/components/onboarding/theme";
import { Spacing } from "@/components/onboarding/theme";
import { Button } from "@/components/onboarding/ui/Button";
import { Card, CardContent } from "@/components/onboarding/ui/Card";
import { InfoBox } from "@/components/onboarding/ui/InfoBox";
import { 
  BookOpen, 
  MessageCircle, 
  Bell, 
  ArrowRight, 
  Info 
} from "lucide-react-native";

interface PersonalizedPathStepProps {
  onNext: () => void;
  onBack: () => void;
}

const PersonalizedPathStep: React.FC<PersonalizedPathStepProps> = ({
  onNext,
  onBack,
}) => {
  return (
    <View style={styles.container}>
      <Text style={[Typography.h2, styles.title]}>
        Your Personalized Trader/Investor Path
      </Text>
      <Text style={[Typography.body1, styles.subtitle]}>
        Great job! Based on your preferences, here's your next step:
      </Text>

      <View style={styles.cardsContainer}>
        <Card style={styles.pathCard}>
          <CardContent style={styles.pathCardContent}>
            <View style={styles.iconContainer}>
              <BookOpen size={24} color={Colors.primary} />
            </View>
            <View style={styles.pathTextContainer}>
              <Text style={Typography.subtitle1}>Beginner Trading Course</Text>
              <Text style={styles.pathDescription}>5 min video</Text>
            </View>
            <ArrowRight size={20} color={Colors.primary} />
          </CardContent>
        </Card>

        <Card style={styles.pathCard}>
          <CardContent style={styles.pathCardContent}>
            <View style={[styles.iconContainer, styles.socialIconContainer]}>
              <MessageCircle size={24} color={Colors.secondary} />
            </View>
            <View style={styles.pathTextContainer}>
              <Text style={Typography.subtitle1}>Follow Financial Influencers</Text>
              <Text style={styles.pathDescription}>TikTok, YouTube</Text>
            </View>
            <ArrowRight size={20} color={Colors.primary} />
          </CardContent>
        </Card>

        <Card style={styles.pathCard}>
          <CardContent style={styles.pathCardContent}>
            <View style={[styles.iconContainer, styles.alertIconContainer]}>
              <Bell size={24} color={Colors.success} />
            </View>
            <View style={styles.pathTextContainer}>
              <Text style={Typography.subtitle1}>Set Up Trade Alerts</Text>
              <Text style={styles.pathDescription}>
                Stay updated on market changes
              </Text>
            </View>
            <ArrowRight size={20} color={Colors.primary} />
          </CardContent>
        </Card>
      </View>

      <InfoBox
        message="Encourages small wins to build momentum and incorporates social learning with influencers."
        type="info"
        icon={<Info size={20} color={Colors.info} />}
        style={styles.infoBox}
      />

      <View style={styles.navigationContainer}>
        <Button title="Back" variant="outline" onPress={onBack} />
        <Button title="Continue" onPress={onNext} />
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
  cardsContainer: {
    marginBottom: Spacing.xl,
  },
  pathCard: {
    marginBottom: Spacing.md,
  },
  pathCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  socialIconContainer: {
    backgroundColor: Colors.secondaryLight,
  },
  alertIconContainer: {
    backgroundColor: Colors.success + "15",
  },
  pathTextContainer: {
    flex: 1,
  },
  pathDescription: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  infoBox: {
    marginBottom: Spacing.xl,
  },
  navigationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export default PersonalizedPathStep;