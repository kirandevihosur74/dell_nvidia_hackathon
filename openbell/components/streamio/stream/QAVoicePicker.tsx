// QAVoicePicker — Voice selection for Live Q&A agent
//
// Shows available ElevenLabs voices as tappable chips.
// Selected voice is stored in inferenceStore and used for TTS responses.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useStreamIOInferenceStore } from '@/stores/streamio/inferenceStore';
import { VOICE_PROFILES } from '@/services/streamio/ttsService';
import { Volume2 } from 'lucide-react-native';

interface VoiceOption {
  voiceId: string;
  name: string;
  description: string;
}

const VOICES: VoiceOption[] = [
  // Built-in ElevenLabs voices
  { voiceId: VOICE_PROFILES.general.voiceId, name: 'Sarah', description: 'Warm & friendly' },
  { voiceId: VOICE_PROFILES.technical.voiceId, name: 'Daniel', description: 'Clear & precise' },
  { voiceId: VOICE_PROFILES.warning.voiceId, name: 'Charlotte', description: 'Expressive' },
  { voiceId: VOICE_PROFILES.discovery.voiceId, name: 'Lily', description: 'Curious & light' },
  { voiceId: VOICE_PROFILES.success.voiceId, name: 'Gigi', description: 'Upbeat & bright' },
  { voiceId: VOICE_PROFILES.professional.voiceId, name: 'Liam', description: 'Professional' },
  // Nigerian voices
  { voiceId: 'it5NMxoQQ2INIh4XcO44', name: 'Fisayo', description: 'Young Nigerian' },
  { voiceId: 'zwbf3iHXH6YGoTCPStfx', name: 'Dayo', description: 'Confident & informative' },
  { voiceId: 'U7wWSnxIJwCjioxt86mk', name: 'Olaniyi', description: 'Warm & calming' },
  { voiceId: 'fGT7Mus3w81KxMRpFtGh', name: 'Paulina', description: 'Calm & conversational' },
  { voiceId: '3mwVS2Cu52S8MzAVx66c', name: 'Dr. Abebe', description: 'Crisp narrator' },
  { voiceId: 'r9DosIwaFvTjhC7gp1d2', name: 'Muyiwa', description: 'Casual & informative' },
  { voiceId: 'neMPCpWtBwWZhxEC8qpe', name: 'Victor', description: 'Deep & narrative' },
];

export const QAVoicePicker: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);
  const qaVoiceId = useStreamIOInferenceStore((s) => s.qaVoiceId);
  const setQAVoiceId = useStreamIOInferenceStore((s) => s.setQAVoiceId);

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Volume2 size={14} color="#8B5CF6" />
        <Text style={[styles.headerText, { color: theme.textSecondary }]}>Q&A Voice</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.voiceRow}>
        {VOICES.map((voice) => {
          const isSelected = qaVoiceId === voice.voiceId;
          return (
            <TouchableOpacity
              key={voice.voiceId}
              style={[
                styles.voiceChip,
                {
                  backgroundColor: isSelected ? '#8B5CF6' : theme.border,
                  borderColor: isSelected ? '#8B5CF6' : theme.border,
                },
              ]}
              onPress={() => setQAVoiceId(voice.voiceId)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.voiceName,
                  { color: isSelected ? '#FFFFFF' : theme.text },
                ]}
              >
                {voice.name}
              </Text>
              <Text
                style={[
                  styles.voiceDesc,
                  { color: isSelected ? 'rgba(255,255,255,0.7)' : theme.textTertiary },
                ]}
              >
                {voice.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  voiceRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  voiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 80,
  },
  voiceName: {
    fontSize: 13,
    fontWeight: '700',
  },
  voiceDesc: {
    fontSize: 10,
    marginTop: 2,
  },
});
