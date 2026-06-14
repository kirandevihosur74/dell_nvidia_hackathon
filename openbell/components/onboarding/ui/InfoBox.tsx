import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { Colors } from "@/components/onboarding/theme";
import { Typography } from "@/components/onboarding/theme";
import { Spacing } from "@/components/onboarding/theme";

interface InfoBoxProps {
  title?: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export const InfoBox: React.FC<InfoBoxProps> = ({
  title,
  message,
  type = "info",
  icon,
  style,
}) => {
  const getBoxStyle = () => {
    switch (type) {
      case "info":
        return styles.info;
      case "success":
        return styles.success;
      case "warning":
        return styles.warning;
      case "error":
        return styles.error;
      default:
        return styles.info;
    }
  };

  return (
    <View style={[styles.container, getBoxStyle(), style]}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <View style={styles.textContainer}>
        {title && <Text style={styles.title}>{title}</Text>}
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    padding: Spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  info: {
    backgroundColor: Colors.info + "15", // 15% opacity
    borderLeftWidth: 4,
    borderLeftColor: Colors.info,
  },
  success: {
    backgroundColor: Colors.success + "15",
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
  },
  warning: {
    backgroundColor: Colors.warning + "15",
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  error: {
    backgroundColor: Colors.error + "15",
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  iconContainer: {
    marginRight: Spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...Typography.subtitle2,
    marginBottom: Spacing.xs,
  },
  message: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
});