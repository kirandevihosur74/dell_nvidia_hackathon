import { View, Text, TextInput, TouchableOpacity, FlatList } from "react-native";
import { useRef, useState, useCallback, useMemo } from "react";
import { Send, Paperclip, Bot } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useGatewayStore } from "@/stores/gatewayStore";

interface Props {
  onSend: (text: string) => void;
  onTyping?: () => void;
  onAttach?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessengerInput({ onSend, onTyping, onAttach, disabled, placeholder }: Props) {
  const { theme } = useThemeStore();
  const agents = useGatewayStore((s) => s.agents);
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState("");

  // Detect @mention in progress for autocomplete
  const mentionQuery = useMemo(() => {
    const match = text.match(/@(\w*)$/);
    if (!match) return null;
    return match[1].toLowerCase();
  }, [text]);

  const filteredAgents = useMemo(() => {
    if (mentionQuery === null) return [];
    if (mentionQuery === "") return agents; // show all on bare @
    return agents.filter(
      (a) =>
        a.name.toLowerCase().startsWith(mentionQuery) ||
        a.id.toLowerCase().startsWith(mentionQuery)
    );
  }, [mentionQuery, agents]);

  const handleChangeText = useCallback(
    (value: string) => {
      setText(value);
      if (value.length > 0) onTyping?.();
    },
    [onTyping]
  );

  const handleSelectAgent = useCallback((agentName: string) => {
    // Replace the @partial with @agentName
    setText((prev) => prev.replace(/@\w*$/, `@${agentName} `));
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }, [text, disabled, onSend]);

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <View>
      {/* Agent mention autocomplete dropdown */}
      {filteredAgents.length > 0 && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.border,
            backgroundColor: theme.card,
            maxHeight: 160,
          }}
        >
          <FlatList
            data={filteredAgents}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelectAgent(item.name)}
                activeOpacity={0.6}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderBottomWidth: 0.5,
                  borderBottomColor: theme.border,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    backgroundColor: theme.primary + "18",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Bot size={14} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text }}>
                    @{item.name}
                  </Text>
                  {item.description ? (
                    <Text style={{ fontSize: 12, color: theme.textTertiary }} numberOfLines={1}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
                <View style={{ backgroundColor: theme.primary + "14", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                  <Text style={{ fontSize: 9, fontWeight: "600", color: theme.primary }}>BOT</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          padding: 10,
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          backgroundColor: theme.card,
        }}
      >
        {/* Attach */}
        <TouchableOpacity
          onPress={onAttach}
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

        {/* Text input */}
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={handleChangeText}
          placeholder={placeholder || "Message..."}
          placeholderTextColor={theme.textTertiary}
          multiline
          maxLength={4000}
          editable={!disabled}
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
        />

        {/* Send */}
        <TouchableOpacity
          onPress={handleSend}
          disabled={!canSend}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: canSend ? theme.primary : theme.border,
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
