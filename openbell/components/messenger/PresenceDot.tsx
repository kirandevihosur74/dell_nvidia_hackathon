import { View } from "react-native";
import type { PresenceStatus } from "@/types/messenger";
import { useThemeStore } from "@/stores/themeStore";

const PRESENCE_COLORS: Record<PresenceStatus, string> = {
  online: "#10B981",
  away: "#F59E0B",
  offline: "#9CA3AF",
};

interface Props {
  status: PresenceStatus;
  size?: number;
}

export function PresenceDot({ status, size = 10 }: Props) {
  const { theme } = useThemeStore();

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: PRESENCE_COLORS[status],
        borderWidth: 2,
        borderColor: theme.background,
      }}
    />
  );
}
