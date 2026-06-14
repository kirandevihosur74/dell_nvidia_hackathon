import { View, Text, TouchableOpacity, Pressable } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useCallback, useMemo, useRef } from "react";
import { Pin, MessageSquare, Camera } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useGatewayStore } from "@/stores/gatewayStore";
import { findAgent } from "@/services/openclaw/agentLookup";
import { sessionManager } from "@/services/gateway/sessionManager";
import { formatMessageTime } from "@/utils/dateFormat";
import { ToolTimeline } from "./ToolTimeline";
import { MessageStatusIndicator } from "./MessageStatusIndicator";
import { VoiceOutputButton } from "@/components/chat/VoiceOutputButton";
import { CardRenderer } from "@/components/cards/CardRenderer";
import { MediaPreview } from "@/components/media/MediaPreview";
import { MarkdownText } from "./MarkdownText";
import { ShareToChatButton } from "@/components/meeting/ShareToChatButton";
import { SpeakToMeetingButton } from "@/components/meeting/SpeakToMeetingButton";
import { ChartRenderer, parseChartMarkers } from "@/components/charts";
import { DiffRenderer, parseDiffBlocks } from "@/components/DiffRenderer";
import type { OpenClawMessage } from "@/types/openclaw";
import type { ToolResultCard, MediaAttachment } from "@/types/cards";

function formatTokenCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

interface Props {
  message: OpenClawMessage;
  onLongPress?: (message: OpenClawMessage) => void;
  onThreadPress?: (messageId: string) => void;
}

function extractCards(message: OpenClawMessage): ToolResultCard[] {
  if (!message.toolCalls) return [];
  const cards: ToolResultCard[] = [];

  for (const tc of message.toolCalls) {
    if (tc.status !== "completed" || !tc.output) continue;
    const output = tc.output as Record<string, unknown>;
    if (output.cardType || output.type) {
      cards.push({
        type: (output.cardType || output.type) as ToolResultCard["type"],
        title: (output.title as string) || tc.toolName,
        subtitle: output.subtitle as string | undefined,
        imageUrl: output.imageUrl as string | undefined,
        data: (output.data as Record<string, unknown>) || output,
        actions: output.actions as ToolResultCard["actions"],
      });
    }
  }
  return cards;
}

function extractMedia(message: OpenClawMessage): MediaAttachment[] {
  if (!message.toolCalls) return [];
  const media: MediaAttachment[] = [];

  for (const tc of message.toolCalls) {
    if (tc.status !== "completed" || !tc.output) continue;
    const output = tc.output as Record<string, unknown>;
    if (output.mediaType && output.uri) {
      media.push({
        id: tc.id,
        type: output.mediaType as MediaAttachment["type"],
        uri: output.uri as string,
        mimeType: (output.mimeType as string) || "application/octet-stream",
        fileName: output.fileName as string | undefined,
        size: output.size as number | undefined,
        width: output.width as number | undefined,
        height: output.height as number | undefined,
        uploadStatus: "complete",
      });
    }
  }
  return media;
}

export function OpenClawMessageBubble({ message, onLongPress, onThreadPress }: Props) {
  const { theme } = useThemeStore();
  const messages = useGatewayStore((s) => s.messages);
  const sessions = useGatewayStore((s) => s.sessions);
  const isUser = message.role === "user";

  // Resolve subagent name for this message's session
  const agentLabel = useMemo(() => {
    const session = sessions.find((s) => s.id === message.sessionId);
    if (session?.agentId) {
      const sub = findAgent(session.agentId);
      return sub?.name || sessionManager.getGatewaySubagentName(session.id) || session.name;
    }
    // No local session — try gateway name lookup directly from the message sessionId
    const gatewayName = sessionManager.getGatewaySubagentName(message.sessionId);
    if (gatewayName) return gatewayName;
    return "Assistant";
  }, [sessions, message.sessionId]);
  const cards = extractCards(message);
  const media = extractMedia(message);

  // Compute thread count from actual replies in the store
  const replyCount = useMemo(
    () => messages.filter((m) => m.threadId === message.id).length,
    [messages, message.id]
  );
  const hasThread = replyCount > 0;

  // Parse charts and diffs from assistant messages
  const { charts, diffs, displayContent } = useMemo(() => {
    if (isUser || !message.content) return { charts: [], diffs: [], displayContent: message.content };
    const chartResult = parseChartMarkers(message.content);
    const diffResult = parseDiffBlocks(chartResult.cleanText);
    return {
      charts: chartResult.charts,
      diffs: diffResult.diffs,
      displayContent: diffResult.cleanText,
    };
  }, [isUser, message.content]);

  const markdownStyles = useMemo(() => ({
    body: { fontSize: 15, lineHeight: 22, color: theme.aiBubbleText },
    strong: { fontWeight: "700" as const },
    em: { fontStyle: "italic" as const },
    code: { backgroundColor: theme.border, borderRadius: 4, paddingHorizontal: 4, fontSize: 13 },
    codeBlock: { backgroundColor: theme.border, borderRadius: 8, padding: 10, fontSize: 13 },
    heading1: { fontSize: 20, fontWeight: "700" as const, color: theme.aiBubbleText },
    heading2: { fontSize: 18, fontWeight: "700" as const, color: theme.aiBubbleText },
    heading3: { fontSize: 16, fontWeight: "600" as const, color: theme.aiBubbleText },
  }), [theme]);

  const lastTapRef = useRef(0);
  const handlePress = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap — open thread
      onThreadPress?.(message.id);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [message.id, onThreadPress]);

  return (
    <Animated.View entering={FadeInDown.duration(300).springify()}>
      <View
        style={{ alignSelf: isUser ? "flex-end" : "flex-start", maxWidth: isUser ? "80%" : "90%", gap: 6 }}
      >
        {/* Pin indicator */}
        {message.isPinned && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 4 }}>
            <Pin size={10} color={theme.warning} />
            <Text style={{ fontSize: 10, color: theme.warning, fontWeight: "500" }}>Pinned</Text>
          </View>
        )}

        {/* Tool timeline */}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <ToolTimeline toolCalls={message.toolCalls} />
        )}

        {/* Live frame indicator */}
        {isUser && message.imageData && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end", paddingRight: 4 }}>
            <Camera size={10} color={theme.primary} />
            <Text style={{ fontSize: 10, color: theme.primary, fontWeight: "500" }}>Live frame</Text>
          </View>
        )}

        {/* Text bubble */}
        {message.content.length > 0 && (
          <Pressable
            onPress={handlePress}
            onLongPress={() => onLongPress?.(message)}
            delayLongPress={500}
            style={{
              backgroundColor: isUser ? theme.userBubble : theme.aiBubble,
              borderWidth: isUser ? 0 : 1,
              borderColor: theme.aiBubbleBorder,
              borderRadius: 16,
              borderBottomRightRadius: isUser ? 4 : 16,
              borderBottomLeftRadius: isUser ? 16 : 4,
              paddingHorizontal: 14,
              paddingVertical: 10,
              overflow: "hidden",
            }}
          >
            {isUser ? (
              <Text selectable style={{ fontSize: 15, lineHeight: 22, color: theme.userBubbleText }}>
                {message.content}
              </Text>
            ) : (
              <>
                {displayContent.length > 0 && (
                  <MarkdownText selectable style={markdownStyles}>{displayContent}</MarkdownText>
                )}

                {/* Inline diffs */}
                {diffs.length > 0 && diffs.map((diff, i) => (
                  <DiffRenderer key={`diff-${i}`} diff={diff} />
                ))}

                {/* Inline charts */}
                {charts.length > 0 && <ChartRenderer charts={charts} />}
              </>
            )}

            {/* Footer */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
              {!isUser && <ShareToChatButton message={message.content} label="Chat" />}
              {!isUser && <SpeakToMeetingButton text={message.content} />}
              {!isUser && <VoiceOutputButton text={message.content} />}
              <MessageStatusIndicator status={message.status} isUser={isUser} />
            </View>
          </Pressable>
        )}

        {/* Metadata row (assistant only) */}
        {!isUser && (
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, paddingLeft: 4, paddingTop: 2 }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: agentLabel !== "Assistant" ? theme.primary : theme.textTertiary }}>{agentLabel}</Text>
            <Text style={{ fontSize: 11, color: theme.textTertiary }}>{formatMessageTime(message.timestamp)}</Text>
            {message.meta?.inputTokens != null && (
              <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                {"↑"}{formatTokenCount(message.meta.inputTokens)}
              </Text>
            )}
            {message.meta?.outputTokens != null && (
              <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                {"↓"}{formatTokenCount(message.meta.outputTokens)}
              </Text>
            )}
            {message.meta?.cacheRead != null && message.meta.cacheRead > 0 && (
              <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                R{formatTokenCount(message.meta.cacheRead)}
              </Text>
            )}
            {message.meta?.cacheWrite != null && message.meta.cacheWrite > 0 && (
              <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                W{formatTokenCount(message.meta.cacheWrite)}
              </Text>
            )}
            {message.meta?.contextPercent != null && (
              <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                {message.meta.contextPercent}% ctx
              </Text>
            )}
            {message.meta?.model && (
              <Text style={{ fontSize: 11, color: theme.textTertiary }}>{message.meta.model}</Text>
            )}
          </View>
        )}

        {/* User metadata row */}
        {isUser && (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, paddingRight: 4, paddingTop: 2 }}>
            <Text style={{ fontSize: 11, color: theme.textTertiary }}>{message.meta?.source || "openclaw-mobile"}</Text>
            <Text style={{ fontSize: 11, color: theme.textTertiary }}>{formatMessageTime(message.timestamp)}</Text>
          </View>
        )}

        {/* Media attachments */}
        {media.length > 0 && (
          <View style={{ gap: 6 }}>
            {media.map((attachment) => (
              <MediaPreview key={attachment.id} attachment={attachment} />
            ))}
          </View>
        )}

        {/* Rich cards */}
        {cards.length > 0 && (
          <View style={{ gap: 8 }}>
            {cards.map((card, index) => (
              <CardRenderer key={`card-${index}`} card={card} />
            ))}
          </View>
        )}

        {/* Thread action — always visible on assistant messages */}
        {!isUser && onThreadPress && (
          <TouchableOpacity
            onPress={() => onThreadPress(message.id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 8,
              backgroundColor: hasThread ? theme.primary + "12" : theme.border + "60",
              alignSelf: "flex-start",
            }}
            activeOpacity={0.6}
          >
            <MessageSquare size={13} color={hasThread ? theme.primary : theme.textTertiary} />
            <Text style={{ fontSize: 12, fontWeight: hasThread ? "600" : "400", color: hasThread ? theme.primary : theme.textTertiary }}>
              {hasThread
                ? `${replyCount} ${replyCount === 1 ? "reply" : "replies"}`
                : "Reply"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}
