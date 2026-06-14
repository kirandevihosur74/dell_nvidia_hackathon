import { View, Text, TouchableOpacity, FlatList, Alert } from "react-native";
import { useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { Plus, Trash2, MessageSquare } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useChatStore } from "@/stores/chatStore";
import { api } from "@/services/apiClient";
import { formatRelativeTime } from "@/utils/dateFormat";
import type { Conversation } from "@/types/chat";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ConversationList({ visible, onClose }: Props) {
  const { theme } = useThemeStore();
  const router = useRouter();
  const { conversations, setConversations, reset } = useChatStore();

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.listConversations();
      setConversations(data as unknown as Conversation[]);
    } catch {
      // silently fail
    }
  }, [setConversations]);

  useEffect(() => {
    if (visible) loadConversations();
  }, [visible, loadConversations]);

  const handleNew = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSelect = useCallback(
    (conv: Conversation) => {
      onClose();
      router.push(`/chat/${conv.id}`);
    },
    [router, onClose]
  );

  const handleDelete = useCallback(
    (conv: Conversation) => {
      Alert.alert("Delete Conversation", `Delete "${conv.title || "Untitled"}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await api.deleteConversation(conv.id);
            loadConversations();
          },
        },
      ]);
    },
    [loadConversations]
  );

  if (!visible) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.4)",
        zIndex: 50,
      }}
    >
      <TouchableOpacity
        style={{ flex: 1 }}
        activeOpacity={1}
        onPress={onClose}
      />
      <View
        style={{
          backgroundColor: theme.card,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: "70%",
          paddingBottom: 34,
        }}
      >
        {/* Header */}
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
          <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text }}>Conversations</Text>
          <TouchableOpacity
            onPress={handleNew}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: theme.primary,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
            }}
          >
            <Plus size={14} color="#FFFFFF" />
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#FFFFFF" }}>New</Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 8 }}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: "center" }}>
              <MessageSquare size={32} color={theme.textTertiary} />
              <Text style={{ fontSize: 14, color: theme.textTertiary, marginTop: 8 }}>
                No conversations yet
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleSelect(item)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 14,
                borderRadius: 10,
                gap: 12,
              }}
            >
              <MessageSquare size={18} color={theme.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "500", color: theme.text }} numberOfLines={1}>
                  {item.title || "Untitled"}
                </Text>
                <Text style={{ fontSize: 12, color: theme.textTertiary }}>
                  {formatRelativeTime(item.updated_at || item.created_at)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={12}>
                <Trash2 size={16} color={theme.error} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}
