import { View, Text, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { useCallback, useRef, useMemo } from "react";
import { ChevronLeft, MessageSquare } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { OpenClawMessageBubble } from "./OpenClawMessageBubble";
import { OpenClawChatInput } from "./OpenClawChatInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { StreamingMessage } from "@/components/chat/StreamingMessage";
import type { OpenClawMessage } from "@/types/openclaw";

interface ThreadViewProps {
  parentMessage: OpenClawMessage;
  replies: OpenClawMessage[];
  streamingContent: string;
  isStreaming: boolean;
  inputValue: string;
  onInputChange: (text: string) => void;
  onSend: (text: string) => void;
  onBack: () => void;
}

export function ThreadView({
  parentMessage,
  replies,
  streamingContent,
  isStreaming,
  inputValue,
  onInputChange,
  onSend,
  onBack,
}: ThreadViewProps) {
  const { theme } = useThemeStore();
  const listRef = useRef<FlatList>(null);

  // Parent + replies
  const allMessages = useMemo(
    () => [parentMessage, ...replies],
    [parentMessage, replies]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: OpenClawMessage; index: number }) => (
      <View>
        <OpenClawMessageBubble message={item} />
        {/* Divider after parent */}
        {index === 0 && replies.length > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
            <Text style={{ fontSize: 11, color: theme.textTertiary }}>
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
          </View>
        )}
      </View>
    ),
    [replies.length, theme]
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
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Thread Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          gap: 10,
        }}
      >
        <TouchableOpacity onPress={onBack} hitSlop={8}>
          <ChevronLeft size={22} color={theme.text} />
        </TouchableOpacity>
        <MessageSquare size={16} color={theme.primary} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: theme.text }}>Thread</Text>
          <Text style={{ fontSize: 12, color: theme.textTertiary }}>
            {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={allMessages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListFooterComponent={renderFooter}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        <OpenClawChatInput
          onSend={onSend}
          disabled={isStreaming}
          value={inputValue}
          onChangeText={onInputChange}
        />
      </KeyboardAvoidingView>
    </View>
  );
}
