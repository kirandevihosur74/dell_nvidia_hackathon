import { View, Text, TouchableOpacity } from "react-native";
import { Lock, LockOpen, ShieldCheck, ShieldAlert } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";

interface EncryptionBadgeProps {
  enabled: boolean;
  verified: boolean;
  onPress?: () => void;
}

export function EncryptionBadge({ enabled, verified, onPress }: EncryptionBadgeProps) {
  const { theme } = useThemeStore();

  if (!enabled) {
    return (
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Encryption disabled. Tap to configure."
        style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: theme.warning + "15" }}
        hitSlop={8}
      >
        <LockOpen size={11} color={theme.warning} />
        <Text style={{ fontSize: 10, color: theme.warning, fontWeight: "500" }}>Unencrypted</Text>
      </TouchableOpacity>
    );
  }

  if (!verified) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: theme.success + "15" }}
        hitSlop={8}
      >
        <Lock size={11} color={theme.success} />
        <Text style={{ fontSize: 10, color: theme.success, fontWeight: "500" }}>Encrypted</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: theme.success + "15" }}
      hitSlop={8}
    >
      <ShieldCheck size={11} color={theme.success} />
      <Text style={{ fontSize: 10, color: theme.success, fontWeight: "500" }}>Verified</Text>
    </TouchableOpacity>
  );
}
