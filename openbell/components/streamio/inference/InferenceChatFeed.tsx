// Inference chat feed — full scrollable chat panel alongside the stream
//
// Features:
//   - Full message history (not limited to last 5)
//   - Agent name + colored badge per message
//   - Streaming text with cursor indicator
//   - Per-agent filter chips at top
//   - Relative timestamps ("2s ago")
//   - Auto-scroll with "new messages" indicator when scrolled up

import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useStreamIOInferenceStore } from '@/stores/streamio/inferenceStore';
import { InferenceChatMessage } from '@/types/streamio/inference';

interface InferenceChatFeedProps {
  maxHeight?: number;
}

export const InferenceChatFeed: React.FC<InferenceChatFeedProps> = ({
  maxHeight = 280,
}) => {
  const { theme } = useThemeStore();
  const chatMessages = useStreamIOInferenceStore((s) => s.chatMessages);
  const viewerToggles = useStreamIOInferenceStore((s) => s.viewerToggles);
  const agentStates = useStreamIOInferenceStore((s) => s.agentStates);

  const scrollRef = useRef<ScrollView>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  // Get unique agent IDs for filter chips
  const agentIds = Object.keys(agentStates);

  // Filter messages
  const filteredMessages = chatMessages.filter((msg) => {
    // Agent toggle filter
    const toggle = viewerToggles[msg.agentId];
    if (toggle && !toggle.chatVisible) return false;
    // Active filter chips
    if (activeFilters.size > 0 && !activeFilters.has(msg.agentId)) return false;
    return true;
  });

  // Auto-scroll on new messages
  useEffect(() => {
    if (!isScrolledUp && filteredMessages.length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 50);
    } else if (isScrolledUp) {
      setHasNewMessages(true);
    }
  }, [filteredMessages.length]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    setIsScrolledUp(distanceFromBottom > 50);
    if (distanceFromBottom <= 50) setHasNewMessages(false);
  }, []);

  const scrollToBottom = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
    setHasNewMessages(false);
  };

  const toggleFilter = (agentId: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  if (chatMessages.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }, { maxHeight }]}>
        <Text style={[styles.emptyText, { color: theme.textTertiary }]}>
          AI chat will appear here during inference
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }, { maxHeight }]}>
      {/* Agent filter chips */}
      {agentIds.length > 1 && (
        <View style={styles.filterRow}>
          {agentIds.map((agentId) => {
            const state = agentStates[agentId];
            if (!state) return null;
            const isActive = activeFilters.size === 0 || activeFilters.has(agentId);

            return (
              <TouchableOpacity
                key={agentId}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? theme.primary : theme.border,
                    opacity: isActive ? 1 : 0.5,
                  },
                ]}
                onPress={() => toggleFilter(agentId)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, { color: isActive ? '#FFFFFF' : theme.textSecondary }]}>
                  {agentId.replace(/-/g, ' ')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.messageList}
        nestedScrollEnabled
      >
        {filteredMessages.map((msg) => (
          <ChatMessageItem key={msg.id} message={msg} />
        ))}
      </ScrollView>

      {/* New messages indicator */}
      {hasNewMessages && (
        <TouchableOpacity
          style={[styles.newMessagesBanner, { backgroundColor: theme.primary }]}
          onPress={scrollToBottom}
          activeOpacity={0.8}
        >
          <Text style={styles.newMessagesText}>New messages</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Chat Message Item ───────────────────────────────────────────────

const ChatMessageItem: React.FC<{ message: InferenceChatMessage }> = React.memo(({ message }) => {
  const { theme } = useThemeStore();
  const relativeTime = getRelativeTime(message.timestamp);
  const isQA = message.agentId === 'live-qa';

  return (
    <View style={[styles.messageItem, isQA && styles.qaMessageItem]}>
      <View style={styles.messageHeader}>
        <View style={[styles.agentBadge, { backgroundColor: message.agentColor }, isQA && styles.qaAgentBadge]}>
          <Text style={styles.agentBadgeText}>{isQA ? 'Q' : message.agentName.charAt(0)}</Text>
        </View>
        <Text style={[styles.agentName, { color: message.agentColor }]} numberOfLines={1}>
          {message.agentName}
        </Text>
        <Text style={[styles.timestamp, { color: theme.textTertiary }]}>{relativeTime}</Text>
      </View>
      <Text style={[styles.messageContent, { color: theme.text }, isQA && styles.qaMessageContent]}>
        {message.content}
        {message.isStreaming && <Text style={[styles.cursor, { color: theme.textTertiary }]}>▌</Text>}
      </Text>
    </View>
  );
});

// ─── Helpers ─────────────────────────────────────────────────────────

function getRelativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 5) return 'now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 32,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  messageList: {
    padding: 8,
    gap: 8,
  },
  messageItem: {
    gap: 3,
  },
  qaMessageItem: {
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  agentBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qaAgentBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  agentBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  agentName: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  timestamp: {
    fontSize: 10,
  },
  messageContent: {
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: 24, // align with text after badge
  },
  qaMessageContent: {
    paddingLeft: 26,
    fontStyle: 'normal',
  },
  cursor: {
    fontSize: 13,
  },
  newMessagesBanner: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  newMessagesText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
