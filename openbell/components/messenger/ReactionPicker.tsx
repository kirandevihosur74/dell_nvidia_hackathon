import { View, Text, TouchableOpacity, Modal, ScrollView } from "react-native";
import { X } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "🔥", "👀", "🚀", "💯"];

const EMOJI_GROUPS: Record<string, string[]> = {
  "Smileys": ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😊", "😇", "🥰", "😍", "🤩", "😘", "😎", "🤔", "🤗", "😬", "😱"],
  "Gestures": ["👍", "👎", "👏", "🙌", "🤝", "✌️", "🤞", "💪", "🫡", "🫶"],
  "Objects": ["🔥", "💯", "⭐", "🎉", "🚀", "💡", "🎯", "✅", "❌", "⚡", "💎", "🏆", "🔔", "📌", "🔗"],
  "Hearts": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "💕"],
};

interface Props {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function ReactionPicker({ visible, onSelect, onClose }: Props) {
  const { theme } = useThemeStore();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={{
            backgroundColor: theme.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "60%",
            paddingBottom: 34,
          }}
        >
          {/* Handle bar */}
          <View style={{ alignItems: "center", paddingVertical: 10 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
          </View>

          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12 }}>
            <Text style={{ fontSize: 17, fontWeight: "600", color: theme.text }}>Reactions</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Quick reactions */}
          <View style={{ flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            {QUICK_REACTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                onPress={() => { onSelect(emoji); onClose(); }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: theme.card,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Full emoji grid */}
          <ScrollView style={{ paddingHorizontal: 16 }}>
            {Object.entries(EMOJI_GROUPS).map(([group, emojis]) => (
              <View key={group} style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textTertiary, marginBottom: 8 }}>
                  {group}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                  {emojis.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      onPress={() => { onSelect(emoji); onClose(); }}
                      style={{
                        width: 38,
                        height: 38,
                        justifyContent: "center",
                        alignItems: "center",
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ fontSize: 22 }}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
