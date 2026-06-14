import { View, Text, TouchableOpacity } from "react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { MessengerReaction } from "@/types/messenger";

interface Props {
  reactions: MessengerReaction[];
  onToggle: (emoji: string, includesMe: boolean) => void;
  onLongPress?: () => void;
}

export function ReactionBar({ reactions, onToggle, onLongPress }: Props) {
  const { theme } = useThemeStore();

  if (reactions.length === 0) return null;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
      {reactions.map((r) => (
        <TouchableOpacity
          key={r.emoji}
          onPress={() => onToggle(r.emoji, r.includesMe)}
          onLongPress={onLongPress}
          activeOpacity={0.6}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
            backgroundColor: r.includesMe ? theme.primary + "20" : theme.card,
            borderWidth: 1,
            borderColor: r.includesMe ? theme.primary + "40" : theme.border,
          }}
        >
          <Text style={{ fontSize: 14 }}>{r.emoji}</Text>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: r.includesMe ? theme.primary : theme.textSecondary,
            }}
          >
            {r.count}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
