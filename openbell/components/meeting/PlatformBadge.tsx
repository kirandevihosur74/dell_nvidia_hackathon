import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Video, Headphones } from "lucide-react-native";
import type { MeetingPlatform } from "@/types/recall";
import { PLATFORM_INFO } from "@/types/recall";

interface Props {
  platform: MeetingPlatform;
  size?: "small" | "medium";
}

export function PlatformBadge({ platform, size = "small" }: Props) {
  const info = PLATFORM_INFO[platform];
  const isSmall = size === "small";
  const Icon = platform === "slack" ? Headphones : Video;

  return (
    <View style={[styles.badge, { backgroundColor: info.color + "20" }, isSmall ? styles.small : styles.medium]}>
      <Icon size={isSmall ? 12 : 16} color={info.color} />
      <Text style={[styles.label, { color: info.color }, isSmall ? styles.labelSmall : styles.labelMedium]}>
        {info.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 6,
    gap: 4,
  },
  small: { paddingHorizontal: 6, paddingVertical: 2 },
  medium: { paddingHorizontal: 8, paddingVertical: 4 },
  label: { fontWeight: "600" },
  labelSmall: { fontSize: 11 },
  labelMedium: { fontSize: 13 },
});
