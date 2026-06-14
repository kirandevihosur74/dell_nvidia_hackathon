import React, { useRef } from "react";
import { StyleSheet, View, Text, ScrollView, Platform } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/components/onboarding/theme";
import { Spacing } from "@/components/onboarding/theme";
import { Typography } from "@/components/onboarding/theme";
import { ProgressBar } from "@/components/onboarding/ui/ProgressBar";
import { useOnboardingStore } from "@/stores/onboardingFlowStore";
import { useOnboardingStore as useAppOnboardingStore } from "@/stores/onboardingStore";
import OnboardingHomeHeader from "./OnboardingHomeHeader";
import SkipButton from "./SkipButton";

import WelcomeStep from "./steps/WelcomeStep";
import InvestmentGoalStep from "./steps/InvestmentGoalStep";
import InvestmentTypeStep from "./steps/InvestmentTypeStep";
import RiskLevelStep from "./steps/RiskLevelStep";
import PersonalizedPathStep from "./steps/PersonalizedPathStep";
import NotificationSetupStep from "./steps/NotificationSetupStep";
import SmartAlertsStep from "./steps/SmartAlertsStep";
import CompletionStep from "./steps/CompletionStep";

interface StepWrapperProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onSkip?: () => void;
}

const StepWrapper: React.FC<StepWrapperProps> = ({ title, subtitle, children, onSkip }) => (
  <View style={styles.stepWrapper}>
    <OnboardingHomeHeader title={title} subtitle={subtitle} />
    <View style={styles.stepContent}>{children}</View>
    {onSkip && (
      <View style={styles.skipButtonContainer}>
        <SkipButton onSkip={onSkip} />
      </View>
    )}
  </View>
);

const TOTAL_STEPS = 8;

const OnboardingFlow: React.FC = () => {
  const { currentStep, setCurrentStep, completeOnboarding } = useOnboardingStore();
  const completeAppOnboarding = useAppOnboardingStore((s) => s.complete);
  const scrollViewRef = useRef<ScrollView>(null);

  const progress = ((currentStep + 1) / TOTAL_STEPS) * 100;

  const scrollToTop = () => scrollViewRef.current?.scrollTo({ y: 0, animated: true });

  const handleNextStep = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep(currentStep + 1);
      scrollToTop();
    }
  };
  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      scrollToTop();
    }
  };
  const handleSkip = () => handleNextStep();

  const handleComplete = () => {
    completeOnboarding();
    completeAppOnboarding();
    router.replace("/(tabs)/report");
  };

  const getStepInfo = (): { title: string; subtitle: string } => {
    switch (currentStep) {
      case 1:
        return { title: "Investment Goals", subtitle: "Tell Us About Your Goals" };
      case 2:
        return { title: "Asset Types", subtitle: "Select Your Preference" };
      case 3:
        return { title: "Risk Level", subtitle: "Set Your Risk Tolerance" };
      case 4:
        return { title: "Personalized Path", subtitle: "Your Learning Journey" };
      case 5:
        return { title: "Notifications", subtitle: "Stay Updated" };
      case 6:
        return { title: "Smart Alerts", subtitle: "Market Opportunities" };
      case 7:
        return { title: "All Set!", subtitle: "Ready to Start" };
      default:
        return { title: "Your OpenBell Journey", subtitle: "Welcome!" };
    }
  };

  const renderStep = () => {
    const { title, subtitle } = getStepInfo();

    switch (currentStep) {
      case 0:
        return <WelcomeStep onNext={handleNextStep} />;
      case 1:
        return (
          <StepWrapper title={title} subtitle={subtitle}>
            <InvestmentGoalStep onNext={handleNextStep} onBack={handlePrevStep} onSkip={handleSkip} />
          </StepWrapper>
        );
      case 2:
        return (
          <StepWrapper title={title} subtitle={subtitle} onSkip={handleSkip}>
            <InvestmentTypeStep onNext={handleNextStep} onBack={handlePrevStep} />
          </StepWrapper>
        );
      case 3:
        return (
          <StepWrapper title={title} subtitle={subtitle} onSkip={handleSkip}>
            <RiskLevelStep onNext={handleNextStep} onBack={handlePrevStep} />
          </StepWrapper>
        );
      case 4:
        return (
          <StepWrapper title={title} subtitle={subtitle} onSkip={handleSkip}>
            <PersonalizedPathStep onNext={handleNextStep} onBack={handlePrevStep} />
          </StepWrapper>
        );
      case 5:
        return (
          <StepWrapper title={title} subtitle={subtitle} onSkip={handleSkip}>
            <NotificationSetupStep onNext={handleNextStep} onBack={handlePrevStep} />
          </StepWrapper>
        );
      case 6:
        return (
          <StepWrapper title={title} subtitle={subtitle} onSkip={handleSkip}>
            <SmartAlertsStep onNext={handleNextStep} onBack={handlePrevStep} />
          </StepWrapper>
        );
      case 7:
        return (
          <StepWrapper title={title} subtitle={subtitle}>
            <CompletionStep onComplete={handleComplete} onBack={handlePrevStep} />
          </StepWrapper>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>{renderStep()}</View>
      </ScrollView>

      <View style={styles.progressContainer}>
        <ProgressBar progress={progress} />
        <Text style={styles.progressText}>
          Step {currentStep + 1} of {TOTAL_STEPS}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 80 },
  content: { flex: 1, maxWidth: 600, width: "100%", alignSelf: "center" },
  stepWrapper: { flex: 1 },
  stepContent: { flex: 1, padding: Spacing.md },
  skipButtonContainer: { alignItems: "center", paddingBottom: Spacing.md },
  progressContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Platform.OS === "ios" ? Spacing.lg : Spacing.md,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  progressText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
});

export default OnboardingFlow;
