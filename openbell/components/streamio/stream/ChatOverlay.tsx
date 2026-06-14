// Chat overlay — AI chat burned into the stream preview
//
// Two modes:
//   1. Inline (default): bottom strip, last 5 messages, Twitch-style
//   2. Fullscreen: right-side panel (~40% width), scrollable, semi-transparent
//
// Features:
//   - Agent name in agent's color as prefix
//   - Streaming text with typewriter cursor
//   - Messages fade out after 15s (inline only)
//   - New messages slide up from bottom

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ScrollView, Dimensions } from 'react-native';
import { useStreamIOInferenceStore } from '@/stores/streamio/inferenceStore';
import { InferenceChatMessage } from '@/types/streamio/inference';

const MAX_VISIBLE_INLINE = 5;
const MAX_VISIBLE_FULLSCREEN = 20;
const MESSAGE_FADE_TIMEOUT_MS = 15000;

interface ChatOverlayProps {
  maxMessages?: number;
  fullscreen?: boolean;
}

export const ChatOverlay: React.FC<ChatOverlayProps> = ({
  maxMessages,
  fullscreen = false,
}) => {
  const chatMessages = useStreamIOInferenceStore((s) => s.chatMessages);
  const viewerToggles = useStreamIOInferenceStore((s) => s.viewerToggles);
  const scrollRef = useRef<ScrollView>(null);

  const limit = maxMessages ?? (fullscreen ? MAX_VISIBLE_FULLSCREEN : MAX_VISIBLE_INLINE);

  const visibleMessages = chatMessages
    .filter((msg) => {
      const toggle = viewerToggles[msg.agentId];
      return !toggle || toggle.overlayVisible;
    })
    .slice(-limit);

  // Auto-scroll in fullscreen mode
  useEffect(() => {
    if (fullscreen && scrollRef.current) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [visibleMessages.length, fullscreen]);

  if (visibleMessages.length === 0) return null;

  // ─── Fullscreen: right-side panel ──────────────────────────────────
  if (fullscreen) {
    return (
      <View style={styles.fullscreenContainer} pointerEvents="none">
        <ScrollView
          ref={scrollRef}
          style={styles.fullscreenScroll}
          contentContainerStyle={styles.fullscreenContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {visibleMessages.map((msg) => (
            <FullscreenMessageRow key={msg.id} message={msg} />
          ))}
        </ScrollView>
      </View>
    );
  }

  // ─── Inline: bottom strip ──────────────────────────────────────────
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.chatBackground}>
        {visibleMessages.map((msg) => (
          <InlineMessageRow key={msg.id} message={msg} />
        ))}
      </View>
    </View>
  );
};

// ─── Fullscreen Message Row ────────────────────────────────────────────

const FullscreenMessageRow: React.FC<{ message: InferenceChatMessage }> = ({ message }) => {
  const slideAnim = useRef(new Animated.Value(12)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.fullscreenRow,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text style={[styles.fullscreenAgent, { color: message.agentColor }]}>
        {message.agentName}
      </Text>
      <Text style={styles.fullscreenText}>
        {message.content}
        {message.isStreaming && <Text style={styles.cursor}>▌</Text>}
      </Text>
    </Animated.View>
  );
};

// ─── Inline Message Row ────────────────────────────────────────────────

const InlineMessageRow: React.FC<{ message: InferenceChatMessage }> = ({ message }) => {
  const slideAnim = useRef(new Animated.Value(20)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    if (message.isComplete) {
      startFadeTimer();
    }

    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (message.isComplete && !fadeTimerRef.current) {
      startFadeTimer();
    }
  }, [message.isComplete]);

  function startFadeTimer() {
    fadeTimerRef.current = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, MESSAGE_FADE_TIMEOUT_MS);
  }

  return (
    <Animated.View
      style={[
        styles.messageRow,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text style={[styles.agentName, { color: message.agentColor }]}>
        {message.agentName}:
      </Text>
      <Text style={styles.messageText} numberOfLines={2}>
        {message.content}
        {message.isStreaming && <Text style={styles.cursor}>▌</Text>}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // ─── Inline (bottom strip) ─────────────────────────────────────────
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  chatBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.60)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  messageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  agentName: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  messageText: {
    color: 'rgba(255, 255, 255, 0.90)',
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },

  // ─── Fullscreen (right-side panel) ─────────────────────────────────
  fullscreenContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '42%',
    zIndex: 20,
  },
  fullscreenScroll: {
    flex: 1,
  },
  fullscreenContent: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 10,
    justifyContent: 'flex-end',
    flexGrow: 1,
  },
  fullscreenRow: {
    gap: 2,
  },
  fullscreenAgent: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  fullscreenText: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 12,
    lineHeight: 17,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // ─── Shared ────────────────────────────────────────────────────────
  cursor: {
    color: 'rgba(255, 255, 255, 0.60)',
    fontSize: 11,
  },
});
