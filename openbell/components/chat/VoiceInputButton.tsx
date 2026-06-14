import { TouchableOpacity, ActivityIndicator } from "react-native";
import { Mic, MicOff } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { useEffect } from "react";
import { useThemeStore } from "@/stores/themeStore";

interface Props {
  isRecording: boolean;
  isTranscribing?: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export function VoiceInputButton({ isRecording, isTranscribing, onPress, disabled }: Props) {
  const { theme } = useThemeStore();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (isRecording) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 600 }),
          withTiming(0, { duration: 600 })
        ),
        -1
      );
    } else {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.value = withTiming(1, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [isRecording, scale, opacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (isTranscribing) {
    return (
      <TouchableOpacity
        disabled
        activeOpacity={0.7}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.primary + "15",
        }}
      >
        <ActivityIndicator size="small" color={theme.primary} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: isRecording ? "rgba(255, 69, 58, 0.15)" : undefined,
      }}
    >
      {/* Pulse ring — pointerEvents="none" so it never intercepts touches */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.error,
          },
          pulseStyle,
        ]}
      />

      {/* Icon */}
      {isRecording ? (
        <MicOff size={20} color={theme.error} />
      ) : (
        <Mic size={20} color={disabled ? theme.textTertiary : theme.textSecondary} />
      )}
    </TouchableOpacity>
  );
}
