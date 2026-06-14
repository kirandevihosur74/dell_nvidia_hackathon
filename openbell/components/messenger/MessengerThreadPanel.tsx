import { View, Text, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { useMemo, useRef, memo, useCallback, useEffect } from "react";
import { ArrowLeft } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeStore } from "@/stores/themeStore";
import { useMessengerStore } from "@/stores/messengerStore";
import { MessengerMessageBubble } from "./MessengerMessageBubble";
import { MessengerInput } from "./MessengerInput";
import { MessengerTypingIndicator } from "./MessengerTypingIndicator";
import * as messengerService from "@/services/messenger/messengerService";
import * as agentBridge from "@/services/messenger/agentBridge";
import { AgentStreamingIndicator } from "./AgentStreamingIndicator";
import type { MessengerMessage } from "@/types/messenger";

const MemoizedBubble = memo(MessengerMessageBubble);

interface Props {
  parentMessageId: string;
  channelId: string;
  onClose: () => void;
}

export function MessengerThreadPanel({ parentMessageId, channelId, onClose }: Props) {
  const { theme } = useThemeStore();
  const listRef = useRef<FlatList>(null);

  const messagesByChannel = useMessengerStore((s) => s.messagesByChannel);
  const threadMessages = useMessengerStore((s) => s.threadMessages);

  // Find parent message
  const parentMessage = useMemo(() => {
    const channelMessages = messagesByChannel[channelId] || [];
    return channelMessages.find((m) => m.id === parentMessageId);
  }, [messagesByChannel, channelId, parentMessageId]);

  // Fetch thread replies on mount
  useEffect(() => {
    messengerService.fetchThreadReplies(parentMessageId);
  }, [parentMessageId]);

  const allMessages = useMemo(() => {
    if (!parentMessage) return threadMessages;
    return [parentMessage, ...threadMessages];
  }, [parentMessage, threadMessages]);

  const handleSend = useCallback((text: string) => {
    messengerService.sendMessage(channelId, text, { threadId: parentMessageId });

    // Check for @agent mentions in thread replies too
    const target = agentBridge.getTargetAgent(text);
    if (target) {
      agentBridge.invokeAgentInChannel(
        channelId,
        text,
        target.agentId,
        target.agentName,
        parentMessageId
      );
    }
  }, [channelId, parentMessageId]);

  const handleTyping = useCallback(() => {
    messengerService.sendTypingIndicator(channelId, parentMessageId);
  }, [channelId, parentMessageId]);

  const handleReactionToggle = useCallback((messageId: string, emoji: string, includesMe: boolean) => {
    if (includesMe) {
      messengerService.removeReaction(messageId, emoji);
    } else {
      messengerService.addReaction(messageId, emoji);
    }
  }, []);

  const renderItem = useCallback(({ item, index }: { item: MessengerMessage; index: number }) => (
    <MemoizedBubble
      message={item}
      onReactionToggle={handleReactionToggle}
      isGrouped={index > 0 && allMessages[index - 1]?.userId === item.userId}
    />
  ), [handleReactionToggle, allMessages]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <ArrowLeft size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: theme.text }}>Thread</Text>
          <Text style={{ fontSize: 13, color: theme.textTertiary }}>
            {threadMessages.length} {threadMessages.length === 1 ? "reply" : "replies"}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={50}>
        <FlatList
          ref={listRef}
          data={allMessages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        <MessengerTypingIndicator channelId={channelId} threadId={parentMessageId} />
        <AgentStreamingIndicator channelId={channelId} />

        <MessengerInput
          onSend={handleSend}
          onTyping={handleTyping}
          placeholder="Reply in thread..."
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
