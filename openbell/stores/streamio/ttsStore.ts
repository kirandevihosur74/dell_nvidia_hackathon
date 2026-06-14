import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VoiceProfile } from '@/services/streamio/ttsService';

interface TTSState {
  enabled: boolean;
  speaking: boolean;
  voiceLock: VoiceProfile | null; // null = auto-detect
  speed: number; // 0.5–2.0
  volume: number; // 0.1–10.0
  error: string | null;
  stats: {
    charactersSent: number;
    requestCount: number;
  };

  // Actions
  setEnabled: (enabled: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  setVoiceLock: (voice: VoiceProfile | null) => void;
  setSpeed: (speed: number) => void;
  setVolume: (volume: number) => void;
  setError: (error: string | null) => void;
  addStats: (chars: number) => void;
  resetStats: () => void;
}

export const useStreamIOTTSStore = create<TTSState>()(
  persist(
    (set) => ({
      enabled: false,
      speaking: false,
      voiceLock: null,
      speed: 1.0,
      volume: 1.0,
      error: null,
      stats: { charactersSent: 0, requestCount: 0 },

      setEnabled: (enabled) => set({ enabled }),
      setSpeaking: (speaking) => set({ speaking }),
      setVoiceLock: (voiceLock) => set({ voiceLock }),
      setSpeed: (speed) => set({ speed: Math.max(0.5, Math.min(2.0, speed)) }),
      setVolume: (volume) => set({ volume: Math.max(0.1, Math.min(10.0, volume)) }),
      setError: (error) => set({ error }),
      addStats: (chars) =>
        set((state) => ({
          stats: {
            charactersSent: state.stats.charactersSent + chars,
            requestCount: state.stats.requestCount + 1,
          },
        })),
      resetStats: () => set({ stats: { charactersSent: 0, requestCount: 0 } }),
    }),
    {
      name: 'streamio:tts',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        enabled: state.enabled,
        voiceLock: state.voiceLock,
        speed: state.speed,
        volume: state.volume,
      }),
    },
  ),
);
