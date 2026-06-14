import { View, Text } from "react-native";
import { WifiOff } from "lucide-react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useOfflineStore } from "@/stores/offlineStore";

export function OfflineBanner() {
  const { isOffline, pendingActions } = useOfflineStore();

  if (!isOffline) return null;

  return (
    <Animated.View entering={FadeInDown.duration(300)} exiting={FadeOutUp.duration(300)}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: "#F59E0B",
          paddingVertical: 8,
          paddingHorizontal: 16,
        }}
      >
        <WifiOff size={14} color="#FFFFFF" />
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#FFFFFF" }}>
          You're offline
          {pendingActions.length > 0
            ? ` · ${pendingActions.length} pending action${pendingActions.length !== 1 ? "s" : ""}`
            : ""}
        </Text>
      </View>
    </Animated.View>
  );
}
