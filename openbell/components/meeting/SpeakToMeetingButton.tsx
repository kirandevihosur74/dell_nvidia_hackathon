import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useThemeStore } from "@/stores/themeStore";
import { useMeetingBotStore } from "@/stores/meetingBotStore";
import * as recallService from "@/services/recall/recallService";
import type { TTSProvider } from "@/types/recall";

interface Props {
  text: string;
}

const VOICES: Record<TTSProvider, Array<{ id: string; label: string }>> = {
  openai: [
    { id: "alloy", label: "Alloy" },
    { id: "echo", label: "Echo" },
    { id: "fable", label: "Fable" },
    { id: "onyx", label: "Onyx" },
    { id: "nova", label: "Nova" },
    { id: "shimmer", label: "Shimmer" },
  ],
  elevenlabs: [
    { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel" },
    { id: "AZnzlk1XvdvUeBnXmlld", label: "Domi" },
    { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella" },
    { id: "MF3mGyEYCl7XYWbV9V6O", label: "Elli" },
  ],
};

export function SpeakToMeetingButton({ text }: Props) {
  const { theme } = useThemeStore();
  const { botId, status } = useMeetingBotStore();
  const [sending, setSending] = useState(false);

  const canSpeak = botId && status === "recording" && text.trim().length > 0;

  const handlePress = () => {
    if (!canSpeak) return;

    const preview = text.length > 80 ? text.slice(0, 80) + "..." : text;
    const provider: TTSProvider = "elevenlabs";
    const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel

    Alert.alert(
      "Speak to Meeting",
      `The bot will say this aloud to all participants:\n\n"${preview}"\n\nProvider: ElevenLabs (Rachel)`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Speak",
          onPress: async () => {
            setSending(true);
            try {
              const result = await recallService.speakToMeeting(botId!, text, provider, voiceId);
              Alert.alert("Spoken", `Bot spoke in meeting (~${Math.round(result.durationMs / 1000)}s)`);
            } catch (err: any) {
              Alert.alert("Failed", err.message || "Could not speak in meeting");
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  if (!canSpeak) return null;

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
          <Feather name="volume-2" size={13} color="#8B5CF6" />
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Speak
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
