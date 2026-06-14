import { View, Text } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { useEffect } from "react";
import { Bot } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useAgentStreamStore } from "@/services/messenger/agentBridge";
import { ToolTimeline } from "@/components/openclaw/ToolTimeline";

interface Props {
  channelId: string;
}

export function AgentStreamingIndicator({ channelId }: Props) {
  const { theme } = useThemeStore();

  // Reactive subscription — re-renders when stream state changes
  const isStreaming = useAgentStreamStore((s) => s.isStreaming);
  const agentName = useAgentStreamStore((s) => s.agentName);
  const streamChannelId = useAgentStreamStore((s) => s.channelId);
  const toolCalls = useAgentStreamStore((s) => s.toolCalls);

  // Pulsing dot animation
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (isStreaming) {
      opacity.value = withRepeat(
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      opacity.value = 1;
    }
  }, [isStreaming, opacity]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!isStreaming || streamChannelId !== channelId) return null;

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: theme.primary + "08",
          borderTopWidth: 1,
          borderTopColor: theme.primary + "15",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Bot size={14} color={theme.primary} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: theme.primary }}>
            {agentName}
          </Text>
          <Animated.View
            style={[
              {
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: theme.primary,
              },
              dotStyle,
            ]}
          />
          <Text style={{ fontSize: 13, color: theme.primary, fontStyle: "italic" }}>
            thinking...
          </Text>
        </View>
      </View>

      {/* Show tool calls if any */}
      {toolCalls.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
          <ToolTimeline toolCalls={toolCalls} />
        </View>
      )}
    </Animated.View>
  );
}
