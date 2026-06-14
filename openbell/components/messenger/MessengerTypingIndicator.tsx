import { View, Text } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useThemeStore } from "@/stores/themeStore";
import { useMessengerStore } from "@/stores/messengerStore";

interface Props {
  channelId: string;
  threadId?: string;
}

export function MessengerTypingIndicator({ channelId, threadId }: Props) {
  const { theme } = useThemeStore();
  const typingUsers = useMessengerStore((s) =>
    s.typingUsers.filter(
      (t) => t.channelId === channelId && t.threadId === (threadId || undefined)
    )
  );

  if (typingUsers.length === 0) return null;

  const names = typingUsers.map((t) => t.displayName);
  let label: string;
  if (names.length === 1) {
    label = `${names[0]} is typing...`;
  } else if (names.length === 2) {
    label = `${names[0]} and ${names[1]} are typing...`;
  } else {
    label = `${names[0]} and ${names.length - 1} others are typing...`;
  }

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 4 }}>
        <View style={{ flexDirection: "row", gap: 3 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: 5,
                height: 5,
                borderRadius: 2.5,
                backgroundColor: theme.textTertiary,
                opacity: 0.6,
              }}
            />
          ))}
        </View>
        <Text style={{ fontSize: 12, color: theme.textTertiary, fontStyle: "italic" }}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}
