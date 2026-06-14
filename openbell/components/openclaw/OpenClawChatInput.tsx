import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useRef, useState, useEffect } from "react";
import { Send, Slash, Paperclip, Camera } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { Mic, MicOff } from "lucide-react-native";
import { stopAllTTS } from "@/components/chat/VoiceOutputButton";
import { MediaPicker } from "@/components/media/MediaPicker";
import { UploadProgress } from "@/components/media/UploadProgress";
import type { MediaAttachment } from "@/types/cards";

interface Props {
  onSend: (text: string, imageData?: string) => void;
  onMediaSelect?: (attachment: MediaAttachment) => void;
  /** Disables send button and action buttons (e.g. during streaming). Input stays typeable. */
  disabled?: boolean;
  /** Fully locks the input (e.g. when disconnected). */
  readOnly?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  pendingMedia?: MediaAttachment | null;
  onCancelMedia?: () => void;
  isStreamLive?: boolean;
  onCaptureFrame?: () => Promise<string | null>;
}

export function OpenClawChatInput({
  onSend,
  onMediaSelect,
  disabled,
  readOnly,
  value,
  onChangeText,
  pendingMedia,
  onCancelMedia,
  isStreamLive,
  onCaptureFrame,
}: Props) {
  const { theme } = useThemeStore();
  const { voiceInputEnabled } = useSettingsStore();
  const inputRef = useRef<TextInput>(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [frameAttached, setFrameAttached] = useState(false);
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleTranscription = (text: string) => {
    if (!text.trim()) return;
    if (disabled) {
      // When disconnected, place transcription in the input box for later
      onChangeText(text.trim());
    } else {
      // Auto-send the transcription immediately
      onSend(text.trim(), capturedFrame || undefined);
      setFrameAttached(false);
      setCapturedFrame(null);
    }
  };

  const { isRecording, isTranscribing, error: voiceError, handlePress: voiceHandlePress, handleLongPress: voiceHandleLongPress } =
    useVoiceInput(handleTranscription);

  useEffect(() => {
    if (voiceError) {
      Alert.alert(
        "Voice Input",
        voiceError,
        [{ text: "OK" }]
      );
    }
  }, [voiceError]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, capturedFrame || undefined);
    setFrameAttached(false);
    setCapturedFrame(null);
  };

  const handleCaptureFrame = async () => {
    if (!onCaptureFrame || isCapturing) return;
    setIsCapturing(true);
    try {
      const frame = await onCaptureFrame();
      if (frame) {
        setCapturedFrame(frame);
        setFrameAttached(true);
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const clearFrame = () => {
    setCapturedFrame(null);
    setFrameAttached(false);
  };

  const handleVoice = () => {
    if (!isRecording) {
      // Stop any active TTS before recording to avoid mic/speaker conflict
      stopAllTTS();
    }
    voiceHandlePress();
  };

  const insertSlash = () => {
    onChangeText("/");
    inputRef.current?.focus();
  };

  return (
    <View>
      {/* Pending media upload indicator */}
      {pendingMedia && pendingMedia.uploadStatus !== "complete" && (
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          <UploadProgress attachment={pendingMedia} onCancel={onCancelMedia} />
        </View>
      )}

      {/* Media picker */}
      <MediaPicker
        visible={showMediaPicker}
        onSelect={(attachment) => {
          onMediaSelect?.(attachment);
          setShowMediaPicker(false);
        }}
        onClose={() => setShowMediaPicker(false)}
      />

      {/* Frame attached indicator */}
      {frameAttached && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 6,
            backgroundColor: theme.primary + "14",
            borderTopWidth: 1,
            borderTopColor: theme.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Camera size={12} color={theme.primary} />
            <Text style={{ fontSize: 12, fontWeight: "500", color: theme.primary }}>
              Live frame attached
            </Text>
          </View>
          <TouchableOpacity onPress={clearFrame} hitSlop={8}>
            <Text style={{ fontSize: 12, color: theme.textTertiary }}>Remove</Text>
          </TouchableOpacity>
        </View>
      )}

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          padding: 12,
          gap: 8,
          borderTopWidth: frameAttached ? 0 : 1,
          borderTopColor: theme.border,
          backgroundColor: theme.card,
        }}
      >
        {/* Attachment button */}
        <TouchableOpacity
          onPress={() => setShowMediaPicker(true)}
          disabled={disabled}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.background,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Paperclip size={16} color={disabled ? theme.textTertiary : theme.textSecondary} />
        </TouchableOpacity>

        {/* Capture live frame button */}
        {isStreamLive && onCaptureFrame && (
          <TouchableOpacity
            onPress={handleCaptureFrame}
            disabled={disabled || isCapturing}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: frameAttached ? theme.primary : theme.background,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {isCapturing ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Camera size={16} color={frameAttached ? "#FFFFFF" : disabled ? theme.textTertiary : theme.primary} />
            )}
          </TouchableOpacity>
        )}

        {/* Slash command shortcut */}
        <TouchableOpacity
          onPress={insertSlash}
          disabled={disabled}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.background,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Slash size={16} color={disabled ? theme.textTertiary : theme.textSecondary} />
        </TouchableOpacity>

        {/* Voice input — inline TouchableOpacity matching LiveStreamBanner pattern */}
        {voiceInputEnabled && (
          <TouchableOpacity
            onPress={handleVoice}
            onLongPress={voiceHandleLongPress}
            disabled={isTranscribing}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: isRecording ? "rgba(239, 68, 68, 0.15)" : theme.background,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {isTranscribing ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : isRecording ? (
              <MicOff size={16} color={theme.error} />
            ) : (
              <Mic size={16} color={theme.textSecondary} />
            )}
          </TouchableOpacity>
        )}

        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={isRecording ? "Listening..." : isTranscribing ? "Transcribing..." : "Message your agent..."}
          placeholderTextColor={isRecording ? theme.error : isTranscribing ? theme.primary : theme.textTertiary}
          multiline
          maxLength={4000}
          style={{
            flex: 1,
            backgroundColor: theme.background,
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 10,
            fontSize: 15,
            color: theme.text,
            maxHeight: 120,
          }}
          onSubmitEditing={handleSend}
          editable={!readOnly}
        />

        <TouchableOpacity
          onPress={handleSend}
          disabled={!value.trim() || disabled}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: value.trim() && !disabled ? theme.primary : theme.border,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Send size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
