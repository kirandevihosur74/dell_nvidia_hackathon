import { View, Text, TouchableOpacity } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useMemo } from "react";
import { MessageSquare, Pin, Bot, Hash } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useMessengerStore } from "@/stores/messengerStore";
import { PresenceDot } from "./PresenceDot";
import { ReactionBar } from "./ReactionBar";
import { FilePreview } from "./FilePreview";
import { MarkdownText } from "@/components/openclaw/MarkdownText";
import { formatMessageTime } from "@/utils/dateFormat";
import type { MessengerMessage } from "@/types/messenger";

interface Props {
  message: MessengerMessage;
  onLongPress?: (message: MessengerMessage) => void;
  onThreadPress?: (messageId: string) => void;
  onReactionToggle?: (messageId: string, emoji: string, includesMe: boolean) => void;
  /** If true, collapse the avatar/name header (consecutive message from same user) */
  isGrouped?: boolean;
}

export function MessengerMessageBubble({
  message,
  onLongPress,
  onThreadPress,
  onReactionToggle,
  isGrouped = false,
}: Props) {
  const { theme } = useThemeStore();
  const currentUserId = useMessengerStore((s) => s.currentUserId);
  const users = useMessengerStore((s) => s.users);
  const isMe = message.userId === currentUserId;
  const hasThread = message.threadCount > 0;
  const isAgent = message.isAgent;

  const userPresence = useMemo(() => {
    const user = users.find((u) => u.id === message.userId);
    return user?.presence || "offline";
  }, [users, message.userId]);

  const markdownStyles = useMemo(() => ({
    body: { fontSize: 15, lineHeight: 22, color: theme.text },
    strong: { fontWeight: "700" as const },
    em: { fontStyle: "italic" as const },
    code: { backgroundColor: theme.border, borderRadius: 4, paddingHorizontal: 4, fontSize: 13 },
    codeBlock: { backgroundColor: theme.border, borderRadius: 8, padding: 10, fontSize: 13 },
    heading1: { fontSize: 18, fontWeight: "700" as const, color: theme.text },
    heading2: { fontSize: 16, fontWeight: "700" as const, color: theme.text },
    heading3: { fontSize: 15, fontWeight: "600" as const, color: theme.text },
  }), [theme]);

  const sourceColor = message.source === "slack" ? "#E01E5A" : message.source === "agent" ? theme.primary : undefined;

  return (
    <Animated.View entering={isGrouped ? undefined : FadeInDown.duration(250).springify()}>
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={() => onLongPress?.(message)}
        delayLongPress={400}
        style={{
          flexDirection: "row",
          gap: 10,
          paddingVertical: isGrouped ? 1 : 6,
          paddingHorizontal: 16,
          opacity: message.status === "optimistic" ? 0.7 : 1,
        }}
      >
        {/* Avatar column */}
        <View style={{ width: 36, alignItems: "center" }}>
          {!isGrouped && (
            <View style={{ position: "relative" }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: isAgent ? theme.primary + "18" : theme.border,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {isAgent ? (
                  <Bot size={18} color={theme.primary} />
                ) : (
                  <Text style={{ fontSize: 15, fontWeight: "600", color: theme.textSecondary }}>
                    {message.displayName.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ position: "absolute", bottom: -2, right: -2 }}>
                <PresenceDot status={userPresence} size={10} />
              </View>
            </View>
          )}
        </View>

        {/* Content column */}
        <View style={{ flex: 1 }}>
          {/* Header: name + time + source badge */}
          {!isGrouped && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text }}>
                {message.displayName}
              </Text>
              {isAgent && (
                <View style={{ backgroundColor: theme.primary + "18", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: "600", color: theme.primary }}>BOT</Text>
                </View>
              )}
              {message.source === "slack" && (
                <View style={{ backgroundColor: "#E01E5A18", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: "600", color: "#E01E5A" }}>SLACK</Text>
                </View>
              )}
              <Text style={{ fontSize: 12, color: theme.textTertiary }}>
                {formatMessageTime(message.createdAt)}
              </Text>
              {message.isEdited && (
                <Text style={{ fontSize: 11, color: theme.textTertiary }}>(edited)</Text>
              )}
              {message.isPinned && (
                <Pin size={11} color={theme.warning} />
              )}
            </View>
          )}

          {/* Message content */}
          {message.content.length > 0 && (
            <MarkdownText style={markdownStyles}>{message.content}</MarkdownText>
          )}

          {/* Status indicator for failed messages */}
          {message.status === "error" && (
            <Text style={{ fontSize: 12, color: theme.error, marginTop: 2 }}>
              Failed to send. Tap to retry.
            </Text>
          )}

          {/* File attachments */}
          <FilePreview files={message.files} />

          {/* Reactions */}
          <ReactionBar
            reactions={message.reactions}
            onToggle={(emoji, includesMe) => onReactionToggle?.(message.id, emoji, includesMe)}
          />

          {/* Thread indicator */}
          {hasThread && (
            <TouchableOpacity
              onPress={() => onThreadPress?.(message.id)}
              activeOpacity={0.6}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                marginTop: 6,
                paddingVertical: 5,
                paddingHorizontal: 8,
                borderRadius: 8,
                backgroundColor: theme.primary + "0A",
              }}
            >
              <MessageSquare size={13} color={theme.primary} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: theme.primary }}>
                {message.threadCount} {message.threadCount === 1 ? "reply" : "replies"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
