import { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  withDelay,
} from "react-native-reanimated";
import { Bot, ArrowRightLeft, ArrowUpRight } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { onRelayStatus, type RelayStatus, type RelayAgentStatus } from "@/services/openclaw/subagentRelay";

const STATUS_LABELS: Record<RelayStatus, string> = {
  idle: "",
  sending: "Sending task to",
  streaming: "Receiving response from",
  relaying: "Relaying response from",
  done: "Response received from",
  error: "Relay failed for",
};

function isActiveStatus(status: RelayStatus) {
  return status === "sending" || status === "streaming" || status === "relaying";
}

/** A single row with a pulsing glow and progress dots */
function RelayRow({ entry, index, onTap }: { entry: RelayAgentStatus; index: number; onTap?: () => void }) {
  const { theme } = useThemeStore();
  const active = isActiveStatus(entry.status);
  const isError = entry.status === "error";
  const isDone = entry.status === "done";

  // Throb opacity
  const opacity = useSharedValue(1);
  // Progress dots
  const dotProgress = useSharedValue(0);

  useEffect(() => {
    if (active) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, // infinite
      );
      dotProgress.value = withRepeat(
        withDelay(
          index * 200, // stagger between rows
          withTiming(3, { duration: 2000, easing: Easing.linear }),
        ),
        -1,
      );
    } else {
      opacity.value = withTiming(1, { duration: 200 });
      dotProgress.value = 0;
    }
  }, [active, index]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const dot1Style = useAnimatedStyle(() => ({
    opacity: dotProgress.value >= 0.5 ? 1 : 0.2,
  }));
  const dot2Style = useAnimatedStyle(() => ({
    opacity: dotProgress.value >= 1.5 ? 1 : 0.2,
  }));
  const dot3Style = useAnimatedStyle(() => ({
    opacity: dotProgress.value >= 2.5 ? 1 : 0.2,
  }));

  const color = isError ? "#EF4444" : isDone ? "#10B981" : theme.primary;
  const Icon = active
    ? entry.status === "relaying" ? ArrowUpRight : ArrowRightLeft
    : Bot;

  const content = (
    <>
      <Icon size={12} color={color} />
      <Text
        style={{
          fontSize: 12,
          color,
          fontWeight: "500",
          flex: 1,
        }}
        numberOfLines={1}
      >
        {STATUS_LABELS[entry.status]} {entry.agentName}
      </Text>
      {active && (
        <View style={{ flexDirection: "row", gap: 3 }}>
          <Animated.View style={[{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }, dot1Style]} />
          <Animated.View style={[{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }, dot2Style]} />
          <Animated.View style={[{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }, dot3Style]} />
        </View>
      )}
      {isDone && (
        <Text style={{ fontSize: 10, color }}>✓</Text>
      )}
    </>
  );

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={rowStyle}
    >
      {onTap ? (
        <TouchableOpacity
          onPress={onTap}
          style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 }}
          hitSlop={6}
        >
          {content}
        </TouchableOpacity>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 }}>
          {content}
        </View>
      )}
    </Animated.View>
  );
}

interface RelayStatusBannerProps {
  onTapAgent?: (agentName: string) => void;
}

export function RelayStatusBanner({ onTapAgent }: RelayStatusBannerProps) {
  const { theme } = useThemeStore();
  const [agents, setAgents] = useState<Map<string, RelayAgentStatus>>(new Map());

  const handleStatus = useCallback((statuses: Map<string, RelayAgentStatus>) => {
    setAgents(statuses);
  }, []);

  useEffect(() => {
    return onRelayStatus(handleStatus);
  }, [handleStatus]);

  const entries = Array.from(agents.values()).filter(a => a.status !== "idle");
  if (entries.length === 0) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 6,
        backgroundColor: theme.primary + "08",
        borderTopWidth: 1,
        borderTopColor: theme.primary + "20",
        gap: 2,
      }}
    >
      {entries.map((entry, i) => (
        <RelayRow
          key={entry.agentName}
          entry={entry}
          index={i}
          onTap={onTapAgent ? () => onTapAgent(entry.agentName) : undefined}
        />
      ))}
    </Animated.View>
  );
}
