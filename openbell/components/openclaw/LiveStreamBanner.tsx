import React, { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import {
  View, Text, TouchableOpacity, Alert, ActivityIndicator,
  Modal, Pressable, StatusBar, TextInput, KeyboardAvoidingView, Platform,
  FlatList,
} from "react-native";
import { Video, X, Square, Play, Send, Minimize2, Mic, MicOff, Volume2 } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useStreamIOStreamStore } from "@/stores/streamio/streamStore";
import { StreamPreview } from "@/components/streamio/stream/StreamPreview";
import { VoiceOutputButton, stopAllTTS } from "@/components/chat/VoiceOutputButton";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import * as StreamService from "@/services/streamio/streamService";
import type { OpenClawMessage } from "@/types/openclaw";

interface LiveStreamBannerProps {
  onDismiss: () => void;
  onSend?: (text: string) => void;
  messages?: OpenClawMessage[];
  streamingContent?: string;
  isAgentStreaming?: boolean;
  inline?: boolean;
}

export interface LiveStreamBannerHandle {
  expandFullscreen: () => void;
}

export const LiveStreamBanner = forwardRef<LiveStreamBannerHandle, LiveStreamBannerProps>(function LiveStreamBanner({
  onDismiss,
  onSend,
  messages = [],
  streamingContent,
  isAgentStreaming,
  inline,
}, ref) {
  const { theme } = useThemeStore();
  const { voiceInputEnabled, voiceOutputEnabled } = useSettingsStore();
  const status = useStreamIOStreamStore((s) => s.status);
  const captureSource = useStreamIOStreamStore((s) => s.captureSource);
  const cameraPosition = useStreamIOStreamStore((s) => s.cameraPosition);
  const lastError = useStreamIOStreamStore((s) => s.lastError);
  const [starting, setStarting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useImperativeHandle(ref, () => ({
    expandFullscreen: () => setIsFullscreen(true),
  }));
  const [fullscreenInput, setFullscreenInput] = useState("");
  const lastTapRef = useRef(0);
  const listRef = useRef<FlatList>(null);
  const userScrolledRef = useRef(false);

  const isLive = status === "streaming";
  const isBusy = status === "starting" || status === "stopping" || starting;

  // Voice input — auto-sends transcription
  const handleTranscription = useCallback((text: string) => {
    if (text.trim() && onSend) {
      onSend(text.trim());
    }
  }, [onSend]);

  const { isRecording, isTranscribing, handlePress: voiceHandlePress } =
    useVoiceInput(handleTranscription);

  const handleVoice = () => {
    if (!isRecording) {
      // Stop any active TTS before recording to avoid mic/speaker conflict
      stopAllTTS();
    }
    voiceHandlePress();
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      const success = await StreamService.startStream();
      if (!success) {
        const err = useStreamIOStreamStore.getState().lastError;
        Alert.alert("Stream Error", err || "Failed to start stream. Check StreamIO settings.");
      }
    } catch (e: any) {
      Alert.alert("Stream Error", e?.message || "Unexpected error starting stream");
    } finally {
      setStarting(false);
    }
  };

  const handleStop = () => {
    Alert.alert("Stop Stream", "Stop the live stream?", [
      { text: "Cancel", style: "cancel" },
      { text: "Stop", style: "destructive", onPress: () => StreamService.stopStream() },
    ]);
  };

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setIsFullscreen(true);
    }
    lastTapRef.current = now;
  }, []);

  const handleFullscreenSend = () => {
    const trimmed = fullscreenInput.trim();
    if (!trimmed || !onSend) return;
    onSend(trimmed);
    setFullscreenInput("");
  };

  // Show last N messages for the fullscreen overlay
  const recentMessages = messages.slice(-20);

  // Last assistant message for TTS in fullscreen
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");

  // Auto-scroll to bottom when fullscreen opens or new messages arrive (only if user hasn't scrolled up)
  useEffect(() => {
    if (isFullscreen && listRef.current && recentMessages.length > 0 && !userScrolledRef.current) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [isFullscreen, recentMessages.length, streamingContent]);

  // Reset scroll tracking when fullscreen opens
  useEffect(() => {
    if (isFullscreen) {
      userScrolledRef.current = false;
    }
  }, [isFullscreen]);

  const renderFullscreenModal = () => (
    <Modal
      visible={isFullscreen}
      animationType="fade"
      supportedOrientations={["portrait", "landscape"]}
      statusBarTranslucent
      onRequestClose={() => setIsFullscreen(false)}
    >
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <StatusBar hidden />
        <Pressable
          style={{ flex: 1 }}
          onPress={() => {
            const now = Date.now();
            if (now - lastTapRef.current < 300) {
              setIsFullscreen(false);
            }
            lastTapRef.current = now;
          }}
        >
          <StreamPreview captureSource={captureSource} isStreaming cameraPosition={cameraPosition} cameraActive fullscreen />
        </Pressable>
        <View style={{ position: "absolute", top: 50, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" }} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFF" }}>LIVE</Text>
            {isRecording && <Text style={{ fontSize: 11, color: "#EF4444", fontWeight: "600" }}>Listening...</Text>}
            {isTranscribing && <Text style={{ fontSize: 11, color: "#60A5FA", fontWeight: "600" }}>Transcribing...</Text>}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {voiceOutputEnabled && lastAssistantMsg && (
              <View style={{ backgroundColor: "rgba(0,0,0,0.5)", padding: 8, borderRadius: 20 }}>
                <VoiceOutputButton text={lastAssistantMsg.content} />
              </View>
            )}
            <TouchableOpacity onPress={() => setIsFullscreen(false)} style={{ backgroundColor: "rgba(0,0,0,0.5)", padding: 8, borderRadius: 20 }}>
              <Minimize2 size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ position: "absolute", bottom: 0, left: 0, right: 0 }} keyboardVerticalOffset={0}>
          <View style={{ maxHeight: 300, paddingHorizontal: 16, marginBottom: 4 }}>
            <FlatList
              ref={listRef}
              data={recentMessages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={{ backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 4, maxWidth: "85%", alignSelf: item.role === "user" ? "flex-end" : "flex-start" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: item.role === "user" ? "#60A5FA" : "#34D399", marginBottom: 1 }}>{item.role === "user" ? "You" : "Agent"}</Text>
                    {item.role === "assistant" && voiceOutputEnabled && <VoiceOutputButton text={item.content} />}
                  </View>
                  <Text style={{ fontSize: 13, color: "#FFF", lineHeight: 17 }}>{item.content}</Text>
                </View>
              )}
              onScrollBeginDrag={() => { userScrolledRef.current = true; }}
              onContentSizeChange={() => {
                if (!userScrolledRef.current) {
                  listRef.current?.scrollToEnd({ animated: true });
                }
              }}
              onScrollToIndexFailed={() => {}}
            />
            {isAgentStreaming && streamingContent ? (
              <View style={{ backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, maxWidth: "85%" }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#34D399", marginBottom: 1 }}>Agent</Text>
                <Text style={{ fontSize: 13, color: "#FFF", lineHeight: 17 }}>{streamingContent}<Text style={{ color: "rgba(255,255,255,0.4)" }}>▊</Text></Text>
              </View>
            ) : isAgentStreaming ? (
              <View style={{ backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: "flex-start" }}>
                <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Thinking...</Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12, paddingVertical: 10, paddingBottom: Platform.OS === "ios" ? 34 : 10, gap: 8, backgroundColor: "rgba(0,0,0,0.6)" }}>
            {voiceInputEnabled && (
              <TouchableOpacity onPress={handleVoice} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isRecording ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" }}>
                {isTranscribing ? <ActivityIndicator size="small" color="#60A5FA" /> : isRecording ? <MicOff size={18} color="#EF4444" /> : <Mic size={18} color="rgba(255,255,255,0.7)" />}
              </TouchableOpacity>
            )}
            <TextInput value={fullscreenInput} onChangeText={setFullscreenInput} placeholder={isRecording ? "Listening..." : isTranscribing ? "Transcribing..." : "Ask about what you see..."} placeholderTextColor={isRecording ? "#EF4444" : isTranscribing ? "#60A5FA" : "rgba(255,255,255,0.4)"} multiline maxLength={4000} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: "#FFF", maxHeight: 100 }} onSubmitEditing={handleFullscreenSend} />
            <TouchableOpacity onPress={handleFullscreenSend} disabled={!fullscreenInput.trim() || !onSend} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: fullscreenInput.trim() ? "#3B82F6" : "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" }}>
              <Send size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );

  // ── Live state: compact preview + controls ──
  if (isLive) {
    // Inline mode: just controls, no camera preview (rendered separately)
    if (inline) {
      return (
        <>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 8,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.error }} />
            <Video size={12} color={theme.error} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: theme.error }}>LIVE</Text>
            {voiceInputEnabled && (
              <TouchableOpacity onPress={handleVoice} hitSlop={8}>
                {isTranscribing ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : isRecording ? (
                  <MicOff size={13} color={theme.error} />
                ) : (
                  <Mic size={13} color={theme.textSecondary} />
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setIsFullscreen(true)} hitSlop={8}>
              <Play size={10} color={theme.error} fill={theme.error} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleStop} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Square size={9} color={theme.error} fill={theme.error} />
              <Text style={{ fontSize: 10, fontWeight: "600", color: theme.error }}>Stop</Text>
            </TouchableOpacity>
          </View>
          {/* Fullscreen modal still available */}
          {renderFullscreenModal()}
        </>
      );
    }

    return (
      <>
        <Pressable
          onPress={handleDoubleTap}
          style={{
            marginHorizontal: 16,
            marginTop: 6,
            marginBottom: 2,
            borderRadius: 10,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: theme.error + "30",
            backgroundColor: theme.card,
          }}
        >
          {/* Header row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 10,
              paddingVertical: 5,
              backgroundColor: theme.error + "14",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.error }} />
              <Video size={12} color={theme.error} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: theme.error }}>LIVE</Text>
              <Text style={{ fontSize: 10, color: theme.textTertiary }}>Double-tap to expand</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {/* Voice mic on compact banner */}
              {voiceInputEnabled && (
                <TouchableOpacity onPress={handleVoice} hitSlop={8}>
                  {isTranscribing ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : isRecording ? (
                    <MicOff size={14} color={theme.error} />
                  ) : (
                    <Mic size={14} color={theme.textSecondary} />
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleStop} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Square size={9} color={theme.error} fill={theme.error} />
                <Text style={{ fontSize: 10, fontWeight: "600", color: theme.error }}>Stop</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onDismiss} hitSlop={8}>
                <X size={12} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>
          {/* Camera preview */}
          <View style={{ height: 100 }}>
            <StreamPreview
              captureSource={captureSource}
              isStreaming
              cameraPosition={cameraPosition}
              cameraActive
            />
          </View>
        </Pressable>

        {renderFullscreenModal()}
      </>
    );
  }

  // ── Idle state: compact start row ──
  if (inline) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8 }}>
        <Video size={13} color={theme.primary} />
        <Text style={{ fontSize: 11, color: theme.textTertiary }}>Stream</Text>
        {isBusy ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <TouchableOpacity
            onPress={handleStart}
            hitSlop={8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 5,
              backgroundColor: theme.primary,
            }}
          >
            <Play size={9} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={{ fontSize: 11, fontWeight: "600", color: "#FFFFFF" }}>Start</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onDismiss} hitSlop={8}>
          <X size={11} color={theme.textTertiary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 6,
        marginBottom: 2,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Video size={14} color={theme.primary} />
        <Text style={{ fontSize: 13, fontWeight: "600", color: theme.text }}>Live Stream</Text>
        <Text style={{ fontSize: 11, color: theme.textTertiary }}>Let your agent see the camera</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {isBusy ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <TouchableOpacity
            onPress={handleStart}
            hitSlop={8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 6,
              backgroundColor: theme.primary,
            }}
          >
            <Play size={10} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#FFFFFF" }}>Start</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onDismiss} hitSlop={8}>
          <X size={12} color={theme.textTertiary} />
        </TouchableOpacity>
      </View>
    </View>
  );
});
