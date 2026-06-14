import { View } from "react-native";
import ReportOnboardingFlow from "@/components/onboarding/report/ReportOnboardingFlow";

// OpenBell onboarding — Report-tailored setup flow.
// The previous gateway-connection welcome is preserved at ./connect.
export default function OnboardingIndex() {
  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <ReportOnboardingFlow />
    </View>
  );
}
