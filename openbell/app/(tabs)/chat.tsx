import { View, Text, FlatList, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useRef, useState } from "react";
import { MessageCircle, Plus } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useChatStore } from "@/stores/chatStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSSEStream } from "@/hooks/useSSEStream";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { StreamingMessage } from "@/components/chat/StreamingMessage";
import { SuggestedPrompts } from "@/components/chat/SuggestedPrompts";
import { SpecialistSelector } from "@/components/chat/SpecialistSelector";
import { ConversationList } from "@/components/chat/ConversationList";
import type { Message } from "@/types/chat";

export default function ChatScreen() {
  const { theme } = useThemeStore();
  const { messages, isStreaming, streamingContent, activeConversationId, addMessage, setActiveConversation } =
    useChatStore();
  const { defaultLlm } = useSettingsStore();
  const { send } = useSSEStream();
  const listRef = useRef<FlatList>(null);
  const [showConversations, setShowConversations] = useState(false);
  const [prefill, setPrefill] = useState("");

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };
      addMessage(userMsg);

      const newConvId = await send(text, activeConversationId, defaultLlm);
      if (newConvId && !activeConversationId) {
        setActiveConversation(newConvId);
      }
    },
    [activeConversationId, defaultLlm, send, addMessage, setActiveConversation]
  );

  const renderItem = useCallback(
    ({ item }: { item: Message }) => <MessageBubble message={item} />,
    []
  );

  const renderFooter = useCallback(() => {
    if (isStreaming && streamingContent) {
      return <StreamingMessage content={streamingContent} />;
    }
    if (isStreaming) {
      return <TypingIndicator />;
    }
    return null;
  }, [isStreaming, streamingContent]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text }}>Asana Copilot</Text>
        <TouchableOpacity onPress={() => setShowConversations(true)} hitSlop={8}>
          <MessageCircle size={22} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Specialist Tabs */}
      <SpecialistSelector />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
      >
        {messages.length === 0 && !isStreaming ? (
          <SuggestedPrompts onSelect={handleSend} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            ListFooterComponent={renderFooter}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        <ChatInput
          onSend={handleSend}
          disabled={isStreaming}
          prefill={prefill}
          onPrefillConsumed={() => setPrefill("")}
        />
      </KeyboardAvoidingView>

      {/* Floating Action Button — New Task */}
      <TouchableOpacity
        onPress={() => setPrefill("Create a task: ")}
        style={{
          position: "absolute",
          bottom: 90,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: theme.primary,
          justifyContent: "center",
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
        }}
        activeOpacity={0.8}
      >
        <Plus size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Conversation List Modal */}
      <ConversationList
        visible={showConversations}
        onClose={() => setShowConversations(false)}
      />
    </SafeAreaView>
  );
}
