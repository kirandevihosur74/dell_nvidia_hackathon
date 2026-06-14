import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useThemeStore } from "@/stores/themeStore";
import { useMeetingBotStore } from "@/stores/meetingBotStore";
import * as recallService from "@/services/recall/recallService";

interface Props {
  message: string;
  label?: string;
}

export function ShareToChatButton({ message, label }: Props) {
  const { theme } = useThemeStore();
  const { botId, status, platform } = useMeetingBotStore();
  const [sending, setSending] = useState(false);

  const canSend = botId && status === "recording" && message.trim().length > 0;

  const handlePress = () => {
    if (!canSend) return;

    const preview = message.length > 100 ? message.slice(0, 100) + "..." : message;

    Alert.alert(
      "Send to Meeting Chat",
      `Send this to all meeting participants?\n\n"${preview}"`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: async () => {
            setSending(true);
            try {
              const firstResult = await recallService.sendChatMessage(botId!, message);

              if (firstResult.truncated && firstResult.charLimit > 0) {
                // Split remaining content into chunks and send sequentially
                const limit = firstResult.charLimit;
                let sent = 1;
                let offset = limit;
                while (offset < message.length) {
                  const chunk = message.slice(offset, offset + limit);
                  await recallService.sendChatMessage(botId!, chunk);
                  sent++;
                  offset += limit;
                }
                Alert.alert("Sent", `Message delivered to ${platform} chat (${sent} parts)`);
              } else {
                Alert.alert("Sent", `Message delivered to ${platform} chat`);
              }
            } catch (err: any) {
              Alert.alert("Failed", err.message || "Could not send message");
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  if (!canSend) return null;

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={sending}
      style={[styles.button, { borderColor: theme.border }]}
    >
      {sending ? (
        <ActivityIndicator size="small" color={theme.textSecondary} />
      ) : (
        <>
          <Feather name="message-square" size={13} color={theme.textSecondary} />
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            {label || "Share to Chat"}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
  },
});
