import React from "react";
import { StyleSheet, TouchableOpacity, View, Text, ViewStyle } from "react-native";
import { Colors } from "@/components/onboarding/theme";
import { Typography } from "@/components/onboarding/theme";
import { Spacing } from "@/components/onboarding/theme";
import { Check } from "lucide-react-native";

interface SelectableCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  selected?: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

export const SelectableCard: React.FC<SelectableCardProps> = ({
  title,
  description,
  icon,
  selected = false,
  onPress,
  style,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.container,
        selected ? styles.selected : styles.unselected,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          {description && <Text style={styles.description}>{description}</Text>}
        </View>
        {selected && (
          <View style={styles.checkContainer}>
            <Check size={20} color={Colors.primary} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  selected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  unselected: {
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  content: {
    padding: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...Typography.subtitle1,
  },
  description: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  checkContainer: {
    marginLeft: Spacing.sm,
  },
});