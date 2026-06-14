import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { useEffect } from "react";
import { useThemeStore } from "@/stores/themeStore";

function Dot({ delay }: { delay: number }) {
  const { theme } = useThemeStore();
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 300 }),
          withTiming(0, { duration: 300 })
        ),
        -1
      )
    );
  }, [delay, translateY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: theme.textTertiary,
        },
        style,
      ]}
    />
  );
}

export function TypingIndicator() {
  const { theme } = useThemeStore();

  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        gap: 4,
        backgroundColor: theme.aiBubble,
        borderWidth: 1,
        borderColor: theme.aiBubbleBorder,
        borderRadius: 16,
        borderBottomLeftRadius: 4,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </View>
  );
}
