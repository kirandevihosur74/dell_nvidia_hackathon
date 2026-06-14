import { View, Text, TouchableOpacity, FlatList, Modal } from "react-native";
import { X, Pin } from "lucide-react-native";
import { useCallback } from "react";
import { useThemeStore } from "@/stores/themeStore";
import { formatMessageTime } from "@/utils/dateFormat";
import type { OpenClawMessage } from "@/types/openclaw";

interface PinnedMessagesProps {
  visible: boolean;
  messages: OpenClawMessage[];
  channelName: string;
  onUnpin: (messageId: string) => void;
  onGoToMessage: (messageId: string) => void;
  onClose: () => void;
}

export function PinnedMessages({
  visible,
  messages,
  channelName,
  onUnpin,
  onGoToMessage,
  onClose,
}: PinnedMessagesProps) {
  const { theme } = useThemeStore();

  const renderItem = useCallback(
    ({ item }: { item: OpenClawMessage }) => (
      <TouchableOpacity
        onPress={() => {
          onGoToMessage(item.id);
          onClose();
        }}
        activeOpacity={0.6}
        style={{
          backgroundColor: theme.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 14,
          marginHorizontal: 16,
          marginBottom: 8,
          gap: 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Pin size={12} color={theme.warning} />
            <Text style={{ fontSize: 11, fontWeight: "600", color: theme.warning }}>Pinned</Text>
          </View>
          <Text style={{ fontSize: 11, color: theme.textTertiary }}>
            {formatMessageTime(item.timestamp)}
          </Text>
        </View>

        <Text style={{ fontSize: 14, color: theme.text, lineHeight: 20 }} numberOfLines={4}>
          {item.content}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <Text style={{ fontSize: 12, color: theme.textTertiary }}>
            {item.role === "assistant" ? "Agent" : "You"}
          </Text>
          <TouchableOpacity
            onPress={() => onUnpin(item.id)}
            hitSlop={8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
              backgroundColor: theme.background,
            }}
          >
            <Text style={{ fontSize: 11, color: theme.textSecondary }}>Unpin</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    ),
    [theme, onGoToMessage, onUnpin, onClose]
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pin size={18} color={theme.warning} />
            <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text }}>
              Pinned in #{channelName}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <X size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={{ padding: 48, alignItems: "center" }}>
              <Pin size={40} color={theme.textTertiary} />
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.textSecondary, marginTop: 12 }}>
                No pinned messages
              </Text>
              <Text style={{ fontSize: 13, color: theme.textTertiary, textAlign: "center", marginTop: 4 }}>
                Long-press a message to pin it for quick reference
              </Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}
