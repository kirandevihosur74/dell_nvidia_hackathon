import { View, TextInput, TouchableOpacity } from "react-native";
import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { VoiceInputButton } from "./VoiceInputButton";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  prefill?: string;
  onPrefillConsumed?: () => void;
}

export function ChatInput({ onSend, disabled, prefill, onPrefillConsumed }: Props) {
  const { theme } = useThemeStore();
  const { voiceInputEnabled } = useSettingsStore();
  const [text, setText] = useState("");
  const handleVoiceTranscription = (transcribedText: string) => {
    if (transcribedText) {
      setText((prev) => (prev ? `${prev} ${transcribedText}` : transcribedText));
    }
  };

  const { isRecording, transcription, handlePress: voiceHandlePress } = useVoiceInput(handleVoiceTranscription);
  const inputRef = useRef<TextInput>(null);

  // Handle prefill from FAB
  useEffect(() => {
    if (prefill) {
      setText(prefill);
      onPrefillConsumed?.();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [prefill]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  const handleVoice = () => {
    voiceHandlePress();
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        padding: 12,
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: theme.border,
        backgroundColor: theme.card,
      }}
    >
      {/* Voice input button */}
      {voiceInputEnabled && (
        <VoiceInputButton isRecording={isRecording} onPress={handleVoice} />
      )}

      <TextInput
        ref={inputRef}
        value={text}
        onChangeText={setText}
        placeholder="Ask anything about your tasks..."
        placeholderTextColor={theme.textTertiary}
        multiline
        maxLength={2000}
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
        editable={!disabled}
      />

      <TouchableOpacity
        onPress={handleSend}
        disabled={!text.trim() || disabled}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: text.trim() && !disabled ? theme.primary : theme.border,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Send size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}
