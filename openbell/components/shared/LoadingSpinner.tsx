import { ActivityIndicator } from "react-native";
import { useThemeStore } from "@/stores/themeStore";

export function LoadingSpinner() {
  const { theme } = useThemeStore();
  return <ActivityIndicator size="large" color={theme.primary} />;
}
