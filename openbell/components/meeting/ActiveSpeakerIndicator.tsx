import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useThemeStore } from "@/stores/themeStore";

interface Props {
  activeSpeaker: string | null;
}

export function ActiveSpeakerIndicator({ activeSpeaker }: Props) {
  const { theme } = useThemeStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (activeSpeaker) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [activeSpeaker]);

  if (!activeSpeaker) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Animated.View style={[styles.dot, { opacity: pulseAnim }]} />
      <Text style={[styles.text, { color: theme.text }]} numberOfLines={1}>
        {activeSpeaker} is speaking
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
    marginRight: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: "500",
  },
});
