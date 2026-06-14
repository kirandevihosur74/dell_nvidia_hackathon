import { Redirect } from "expo-router";
import { useOnboardingStore } from "@/stores/onboardingStore";

export default function Index() {
  const { completed } = useOnboardingStore();
  return <Redirect href={completed ? "/(tabs)/report" : "/onboarding"} />;
}
