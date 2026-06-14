import React, { useRef, useState } from "react";
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Platform } from "react-native";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Colors, Spacing, Typography } from "@/components/onboarding/theme";
import { ProgressBar } from "@/components/onboarding/ui/ProgressBar";
import OnboardingHomeHeader from "@/components/onboarding/OnboardingHomeHeader";
import { useReportConfigStore } from "@/stores/reportConfigStore";
import { useOnboardingStore as useAppOnboardingStore } from "@/stores/onboardingStore";

import WelcomeStep from "./steps/WelcomeStep";
import WatchlistStep from "./steps/WatchlistStep";
import AnalysisStep from "./steps/AnalysisStep";
import ScheduleStep from "./steps/ScheduleStep";
import AlertsStep from "./steps/AlertsStep";
import CompletionStep from "./steps/CompletionStep";

const TOTAL_STEPS = 6;

const STEP_INFO: { title: string; subtitle: string }[] = [
  { title: "Your OpenBell Journey", subtitle: "Welcome!" },
  { title: "Your Watchlist", subtitle: "Pick your tickers" },
  { title: "What to Analyze", subtitle: "Choose your coverage" },
  { title: "Bell Schedule", subtitle: "Opening & Closing Bell" },
  { title: "Alerts", subtitle: "Stay in the loop" },
  { title: "All Set!", subtitle: "Your reports are ready" },
];

const StepWrapper: React.FC<{ title: string; subtitle: string; onBack?: () => void; children: React.ReactNode }> = ({
  title,
  subtitle,
  onBack,
  children,
}) => (
  <View style={styles.stepWrapper}>
    <OnboardingHomeHeader title={title} subtitle={subtitle} />
    <View style={styles.stepContent}>
      {children}
      {onBack && (
        <TouchableOpacity style={styles.back} onPress={onBack} activeOpacity={0.7}>
          <ChevronLeft size={16} color={Colors.textSecondary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
);

const ReportOnboardingFlow: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const markConfigured = useReportConfigStore((s) => s.markConfigured);
  const completeAppOnboarding = useAppOnboardingStore((s) => s.complete);

  const progress = ((currentStep + 1) / TOTAL_STEPS) * 100;
  const scrollToTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });

  const next = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((s) => s + 1);
      scrollToTop();
    }
  };
  const back = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      scrollToTop();
    }
  };
  const complete = () => {
    markConfigured();
    completeAppOnboarding();
    router.replace("/(tabs)/report");
  };

  const renderStep = () => {
    const info = STEP_INFO[currentStep];
    switch (currentStep) {
      case 0:
        return <WelcomeStep onNext={next} />;
      case 1:
        return (
          <StepWrapper title={info.title} subtitle={info.subtitle} onBack={back}>
            <WatchlistStep onNext={next} onBack={back} />
          </StepWrapper>
        );
      case 2:
        return (
          <StepWrapper title={info.title} subtitle={info.subtitle} onBack={back}>
            <AnalysisStep onNext={next} onBack={back} />
          </StepWrapper>
        );
      case 3:
        return (
          <StepWrapper title={info.title} subtitle={info.subtitle} onBack={back}>
            <ScheduleStep onNext={next} onBack={back} />
          </StepWrapper>
        );
      case 4:
        return (
          <StepWrapper title={info.title} subtitle={info.subtitle} onBack={back}>
            <AlertsStep onNext={next} onBack={back} />
          </StepWrapper>
        );
      case 5:
        return (
          <StepWrapper title={info.title} subtitle={info.subtitle} onBack={back}>
            <CompletionStep onComplete={complete} onBack={back} />
          </StepWrapper>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
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
  back: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: Spacing.md },
  backText: { ...Typography.body2, color: Colors.textSecondary, fontWeight: "600" },
  progressContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Platform.OS === "ios" ? Spacing.lg : Spacing.md,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  progressText: { ...Typography.caption, color: Colors.textSecondary, marginTop: Spacing.xs, textAlign: "center" },
});

export default ReportOnboardingFlow;
