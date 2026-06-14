import { View, Text, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { ChevronLeft } from "lucide-react-native";
import { TouchableOpacity } from "react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useChatStore } from "@/stores/chatStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSSEStream } from "@/hooks/useSSEStream";
import { api } from "@/services/apiClient";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { StreamingMessage } from "@/components/chat/StreamingMessage";
import type { Message } from "@/types/chat";

export default function ConversationScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const { theme } = useThemeStore();
  const { messages, isStreaming, streamingContent, setMessages, addMessage, setActiveConversation } =
    useChatStore();
  const { defaultLlm } = useSettingsStore();
  const { send } = useSSEStream();
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (conversationId) {
      setActiveConversation(conversationId);
      api.getMessages(conversationId).then((msgs) => {
        setMessages(
          msgs.map((m) => ({
            id: String(m.id),
            role: m.role as "user" | "assistant",
            content: String(m.content),
            timestamp: String(m.created_at || new Date().toISOString()),
          }))
        );
      });
    }
  }, [conversationId, setActiveConversation, setMessages]);

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };
      addMessage(userMsg);
      await send(text, conversationId || null, defaultLlm);
    },
    [conversationId, defaultLlm, send, addMessage]
  );

  const renderFooter = useCallback(() => {
    if (isStreaming && streamingContent) return <StreamingMessage content={streamingContent} />;
    if (isStreaming) return <TypingIndicator />;
    return null;
  }, [isStreaming, streamingContent]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text }}>Conversation</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={90}>
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={({ item }) => <MessageBubble message={item} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListFooterComponent={renderFooter}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: true })}
          maintainVisibleContentPosition={null}
        />
        <ChatInput onSend={handleSend} disabled={isStreaming} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
