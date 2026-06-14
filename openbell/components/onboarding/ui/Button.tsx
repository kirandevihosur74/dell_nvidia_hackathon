import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from "react-native";
import { Colors } from "@/components/onboarding/theme";
import { Typography } from "@/components/onboarding/theme";
import { Spacing } from "@/components/onboarding/theme";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "text";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  icon,
  iconPosition = "left",
  style,
  textStyle,
  fullWidth = false,
}) => {
  const getButtonStyle = () => {
    let buttonStyle: ViewStyle = {};

    // Variant styles
    switch (variant) {
      case "primary":
        buttonStyle = {
          backgroundColor: Colors.primary,
          borderWidth: 0,
        };
        break;
      case "secondary":
        buttonStyle = {
          backgroundColor: Colors.secondary,
          borderWidth: 0,
        };
        break;
      case "outline":
        buttonStyle = {
          backgroundColor: "transparent",
          borderWidth: 1,
          borderColor: Colors.primary,
        };
        break;
      case "text":
        buttonStyle = {
          backgroundColor: "transparent",
          borderWidth: 0,
          paddingHorizontal: 0,
        };
        break;
    }

    // Size styles
    switch (size) {
      case "small":
        buttonStyle = {
          ...buttonStyle,
          paddingVertical: Spacing.xs,
          paddingHorizontal: Spacing.md,
        };
        break;
      case "medium":
        buttonStyle = {
          ...buttonStyle,
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.md,
        };
        break;
      case "large":
        buttonStyle = {
          ...buttonStyle,
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.lg,
        };
        break;
    }

    // Disabled style
    if (disabled) {
      buttonStyle = {
        ...buttonStyle,
        opacity: 0.5,
      };
    }

    // Full width style
    if (fullWidth) {
      buttonStyle = {
        ...buttonStyle,
        width: "100%",
      };
    }

    return buttonStyle;
  };

  const getTextStyle = () => {
    let style: TextStyle = {
      ...Typography.button,
    };

    if (size === "small") {
      style = {
        ...style,
        ...Typography.buttonSmall,
      };
    }

    switch (variant) {
      case "primary":
      case "secondary":
        style = {
          ...style,
          color: Colors.white,
        };
        break;
      case "outline":
      case "text":
        style = {
          ...style,
          color: Colors.primary,
        };
        break;
    }

    return style;
  };

  return (
    <TouchableOpacity
      style={[styles.button, getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" || variant === "secondary" ? Colors.white : Colors.primary}
          size="small"
        />
      ) : (
        <View style={styles.contentContainer}>
          {icon && iconPosition === "left" && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
          {icon && iconPosition === "right" && <View style={styles.iconRight}>{icon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  contentContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconLeft: {
    marginRight: Spacing.xs,
  },
  iconRight: {
    marginLeft: Spacing.xs,
  },
});