import { View } from "react-native";
import ReportOnboardingFlow from "@/components/onboarding/report/ReportOnboardingFlow";

// Dedicated tab to (re)run the Report-tailored onboarding flow on demand.
export default function OnboardingTab() {
  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <ReportOnboardingFlow />
    </View>
  );
}
