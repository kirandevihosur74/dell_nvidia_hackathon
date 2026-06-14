import { StyleSheet } from "react-native";

/**
 * Self-contained design tokens for the onboarding flow (ported from onboardingx5).
 * Kept local to components/onboarding so it never collides with the app's
 * primary theme in @/constants/colors.
 */
export const Colors = {
  primary: "#4F46E5", // Indigo
  primaryLight: "#EEF2FF",
  primaryDark: "#3730A3",
  secondary: "#10B981", // Emerald
  secondaryLight: "#D1FAE5",
  secondaryDark: "#047857",
  background: "#FFFFFF",
  card: "#F9FAFB",
  text: "#1F2937",
  textSecondary: "#6B7280",
  textLight: "#9CA3AF",
  border: "#E5E7EB",
  borderLight: "#F3F4F6",
  error: "#EF4444",
  warning: "#F59E0B",
  success: "#34C759",
  info: "#007AFF",
  white: "#FFFFFF",
  black: "#000000",
  gray: {
    50: "#F9FAFB",
    100: "#F3F4F6",
    200: "#E5E7EB",
    300: "#D1D5DB",
    400: "#9CA3AF",
    500: "#6B7280",
    600: "#4B5563",
    700: "#374151",
    800: "#1F2937",
    900: "#111827",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Typography = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: "700", color: Colors.text, lineHeight: 34 },
  h2: { fontSize: 24, fontWeight: "700", color: Colors.text, lineHeight: 30 },
  h3: { fontSize: 20, fontWeight: "600", color: Colors.text, lineHeight: 26 },
  h4: { fontSize: 18, fontWeight: "600", color: Colors.text, lineHeight: 24 },
  subtitle1: { fontSize: 16, fontWeight: "600", color: Colors.text, lineHeight: 22 },
  subtitle2: { fontSize: 14, fontWeight: "600", color: Colors.text, lineHeight: 20 },
  body1: { fontSize: 16, fontWeight: "400", color: Colors.text, lineHeight: 22 },
  body2: { fontSize: 14, fontWeight: "400", color: Colors.text, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: "400", color: Colors.textSecondary, lineHeight: 16 },
  button: { fontSize: 16, fontWeight: "600", lineHeight: 22 },
  buttonSmall: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
});
