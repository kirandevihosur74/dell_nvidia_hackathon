import React, { useState } from "react";
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  Switch,
  TouchableOpacity
} from "react-native";
import { Colors } from "@/components/onboarding/theme";
import { Typography } from "@/components/onboarding/theme";
import { Spacing } from "@/components/onboarding/theme";
import { Button } from "@/components/onboarding/ui/Button";
import { Card, CardContent } from "@/components/onboarding/ui/Card";
import { InfoBox } from "@/components/onboarding/ui/InfoBox";
import { useOnboardingStore } from "@/stores/onboardingFlowStore";
import { 
  Info, 
  BookOpen, 
  TrendingUp, 
  Users, 
  Award 
} from "lucide-react-native";

interface NotificationSetupStepProps {
  onNext: () => void;
  onBack: () => void;
}

const NotificationSetupStep: React.FC<NotificationSetupStepProps> = ({
  onNext,
  onBack,
}) => {
  const { notificationPreferences, setNotificationPreferences } = useOnboardingStore();
  
  const [preferences, setPreferences] = useState({
    ...notificationPreferences
  });

  const updatePreference = (key: keyof typeof preferences, value: boolean | string) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleContinue = () => {
    setNotificationPreferences(preferences);
    onNext();
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[Typography.h2, styles.title]}>Stay Updated</Text>
      <Text style={[Typography.body1, styles.subtitle]}>
        Customize how and when you want to receive updates
      </Text>

      <InfoBox
        title="Why This Matters"
        message="Staying informed helps you make better investment decisions. Customize your notifications to focus on what's most relevant to your investment journey."
        type="info"
        icon={<Info size={20} color={Colors.info} />}
        style={styles.infoBox}
      />

      <View style={styles.contentGrid}>
        {/* Notification Types */}
        <View style={styles.section}>
          <Text style={[Typography.subtitle1, styles.sectionTitle]}>
            What Would You Like to Know About?
          </Text>

          <View style={styles.optionsContainer}>
            <Card style={styles.optionCard}>
              <CardContent style={styles.optionContent}>
                <View style={styles.optionCheckbox}>
                  <Switch
                    value={preferences.learning}
                    onValueChange={(value) => updatePreference("learning", value)}
                    trackColor={{ false: Colors.gray[300], true: Colors.primary }}
                    thumbColor={Colors.white}
                  />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={Typography.subtitle2}>Learning Content</Text>
                  <Text style={styles.optionDescription}>
                    Daily tips, weekly lessons, and personalized educational content
                  </Text>
                </View>
              </CardContent>
            </Card>

            <Card style={styles.optionCard}>
              <CardContent style={styles.optionContent}>
                <View style={styles.optionCheckbox}>
                  <Switch
                    value={preferences.market}
                    onValueChange={(value) => updatePreference("market", value)}
                    trackColor={{ false: Colors.gray[300], true: Colors.primary }}
                    thumbColor={Colors.white}
                  />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={Typography.subtitle2}>Market Alerts</Text>
                  <Text style={styles.optionDescription}>
                    Major market movements, portfolio impacts, and asset notifications
                  </Text>
                </View>
              </CardContent>
            </Card>

            <Card style={styles.optionCard}>
              <CardContent style={styles.optionContent}>
                <View style={styles.optionCheckbox}>
                  <Switch
                    value={preferences.social}
                    onValueChange={(value) => updatePreference("social", value)}
                    trackColor={{ false: Colors.gray[300], true: Colors.primary }}
                    thumbColor={Colors.white}
                  />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={Typography.subtitle2}>Social Updates</Text>
                  <Text style={styles.optionDescription}>
                    Content from followed creators, community challenges, and events
                  </Text>
                </View>
              </CardContent>
            </Card>

            <Card style={styles.optionCard}>
              <CardContent style={styles.optionContent}>
                <View style={styles.optionCheckbox}>
                  <Switch
                    value={preferences.achievements}
                    onValueChange={(value) => updatePreference("achievements", value)}
                    trackColor={{ false: Colors.gray[300], true: Colors.primary }}
                    thumbColor={Colors.white}
                  />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={Typography.subtitle2}>Achievements & Progress</Text>
                  <Text style={styles.optionDescription}>
                    Milestone notifications, badges earned, and investing progress
                  </Text>
                </View>
              </CardContent>
            </Card>
          </View>
        </View>

        {/* Frequency & Examples */}
        <View style={styles.section}>
          <Text style={[Typography.subtitle1, styles.sectionTitle]}>
            How Often Should We Update You?
          </Text>

          <Card style={styles.frequencyCard}>
            <CardContent>
              <Text style={[Typography.subtitle2, styles.frequencyTitle]}>
                Notification Frequency
              </Text>
              <View style={styles.frequencyOptions}>
                {[
                  { value: "realtime", label: "Real-time (As they happen)" },
                  { value: "daily", label: "Daily Digest" },
                  { value: "weekly", label: "Weekly Roundup" },
                  { value: "important", label: "Important Only" },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.frequencyOption,
                      preferences.frequency === option.value && styles.selectedFrequency,
                    ]}
                    onPress={() => updatePreference("frequency", option.value)}
                  >
                    <View style={styles.radioButton}>
                      <View
                        style={[
                          styles.radioInner,
                          preferences.frequency === option.value && styles.radioSelected,
                        ]}
                      />
                    </View>
                    <Text style={styles.frequencyLabel}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </CardContent>
          </Card>

          {/* Example Notifications */}
          <Text style={[Typography.subtitle2, styles.examplesTitle]}>
            Example Notifications
          </Text>
          <View style={styles.examplesContainer}>
            {preferences.learning && (
              <Card style={styles.exampleCard}>
                <CardContent style={styles.exampleContent}>
                  <View style={[styles.exampleIcon, styles.learningIcon]}>
                    <BookOpen size={16} color={Colors.primary} />
                  </View>
                  <View style={styles.exampleTextContainer}>
                    <Text style={Typography.subtitle2}>New in Learning</Text>
                    <Text style={styles.exampleMessage}>
                      Your "ETF Basics" mini-course is now available!
                    </Text>
                  </View>
                </CardContent>
              </Card>
            )}

            {preferences.market && (
              <Card style={styles.exampleCard}>
                <CardContent style={styles.exampleContent}>
                  <View style={[styles.exampleIcon, styles.marketIcon]}>
                    <TrendingUp size={16} color={Colors.success} />
                  </View>
                  <View style={styles.exampleTextContainer}>
                    <Text style={Typography.subtitle2}>Market Alert</Text>
                    <Text style={styles.exampleMessage}>
                      VTI is up 2.5% today after positive economic news.
                    </Text>
                  </View>
                </CardContent>
              </Card>
            )}

            {preferences.social && (
              <Card style={styles.exampleCard}>
                <CardContent style={styles.exampleContent}>
                  <View style={[styles.exampleIcon, styles.socialIcon]}>
                    <Users size={16} color={Colors.secondary} />
                  </View>
                  <View style={styles.exampleTextContainer}>
                    <Text style={Typography.subtitle2}>Social Update</Text>
                    <Text style={styles.exampleMessage}>
                      @investing_olivia just posted: "3 ETFs every beginner should know"
                    </Text>
                  </View>
                </CardContent>
              </Card>
            )}

            {preferences.achievements && (
              <Card style={styles.exampleCard}>
                <CardContent style={styles.exampleContent}>
                  <View style={[styles.exampleIcon, styles.achievementIcon]}>
                    <Award size={16} color={Colors.warning} />
                  </View>
                  <View style={styles.exampleTextContainer}>
                    <Text style={Typography.subtitle2}>Achievement Unlocked</Text>
                    <Text style={styles.exampleMessage}>
                      You've earned the "First Trade Pro" badge!
                    </Text>
                  </View>
                </CardContent>
              </Card>
            )}

            {!preferences.learning && !preferences.market && !preferences.social && !preferences.achievements && (
              <Card style={styles.exampleCard}>
                <CardContent style={styles.emptyExampleContent}>
                  <Text style={styles.emptyExampleText}>
                    No notification examples to show. Enable at least one category.
                  </Text>
                </CardContent>
              </Card>
            )}
          </View>
        </View>
      </View>

      <View style={styles.navigationContainer}>
        <Button title="Back" variant="outline" onPress={onBack} />
        <Button
          title="Save Preferences & Continue"
          onPress={handleContinue}
        />
      </View>
    </ScrollView>
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
    marginBottom: Spacing.lg,
  },
  infoBox: {
    marginBottom: Spacing.xl,
  },
  contentGrid: {
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  optionsContainer: {
    marginBottom: Spacing.md,
  },
  optionCard: {
    marginBottom: Spacing.sm,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  optionCheckbox: {
    marginRight: Spacing.sm,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionDescription: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  frequencyCard: {
    marginBottom: Spacing.md,
  },
  frequencyTitle: {
    marginBottom: Spacing.sm,
  },
  frequencyOptions: {
    marginBottom: Spacing.xs,
  },
  frequencyOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  selectedFrequency: {
    backgroundColor: Colors.primaryLight,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "transparent",
  },
  radioSelected: {
    backgroundColor: Colors.primary,
  },
  frequencyLabel: {
    ...Typography.body2,
  },
  examplesTitle: {
    marginBottom: Spacing.sm,
  },
  examplesContainer: {
    marginBottom: Spacing.md,
  },
  exampleCard: {
    marginBottom: Spacing.sm,
  },
  exampleContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  exampleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  learningIcon: {
    backgroundColor: Colors.primaryLight,
  },
  marketIcon: {
    backgroundColor: Colors.success + "15",
  },
  socialIcon: {
    backgroundColor: Colors.secondary + "15",
  },
  achievementIcon: {
    backgroundColor: Colors.warning + "15",
  },
  exampleTextContainer: {
    flex: 1,
  },
  exampleMessage: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyExampleContent: {
    padding: Spacing.md,
    alignItems: "center",
  },
  emptyExampleText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  navigationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.xl,
  },
});

export default NotificationSetupStep;