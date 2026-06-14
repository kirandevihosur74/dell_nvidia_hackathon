import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LLMProvider } from "@/types/settings";

export type VoiceProfileOption =
  | "auto"
  | "general" | "technical" | "warning" | "discovery" | "success" | "professional"
  | "fisayo" | "dayo" | "olaniyi" | "paulina" | "dr_abebe" | "muyiwa" | "victor";

const NERVE_URL_KEY = "openclaw_nerve_url";

interface SettingsState {
  defaultLlm: LLMProvider;
  voiceInputEnabled: boolean;
  voiceOutputEnabled: boolean;
  elevenLabsApiKey: string;
  voiceProfile: VoiceProfileOption;
  darkMode: "system" | "light" | "dark";
  notificationsEnabled: boolean;
  streamioFirstRunComplete: boolean;
  nerveUrl: string;

  setDefaultLlm: (provider: LLMProvider) => void;
  setVoiceInput: (enabled: boolean) => void;
  setVoiceOutput: (enabled: boolean) => void;
  setElevenLabsApiKey: (key: string) => void;
  setVoiceProfile: (profile: VoiceProfileOption) => void;
  setDarkMode: (mode: "system" | "light" | "dark") => void;
  setNotifications: (enabled: boolean) => void;
  setStreamioFirstRunComplete: (complete: boolean) => void;
  setNerveUrl: (url: string) => void;
  loadNerveUrl: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  defaultLlm: "gemini",
  voiceInputEnabled: true,
  voiceOutputEnabled: true,
  elevenLabsApiKey: "",
  voiceProfile: "auto",
  darkMode: "system",
  notificationsEnabled: true,
  streamioFirstRunComplete: true,
  nerveUrl: "http://localhost:3080",

  setDefaultLlm: (provider) => set({ defaultLlm: provider }),
  setVoiceInput: (enabled) => set({ voiceInputEnabled: enabled }),
  setVoiceOutput: (enabled) => set({ voiceOutputEnabled: enabled }),
  setElevenLabsApiKey: (key) => set({ elevenLabsApiKey: key }),
  setVoiceProfile: (profile) => set({ voiceProfile: profile }),
  setDarkMode: (mode) => set({ darkMode: mode }),
  setNotifications: (enabled) => set({ notificationsEnabled: enabled }),
  setStreamioFirstRunComplete: (complete) => set({ streamioFirstRunComplete: complete }),
  setNerveUrl: (url) => {
    set({ nerveUrl: url });
    AsyncStorage.setItem(NERVE_URL_KEY, url);
  },
  loadNerveUrl: async () => {
    try {
      const stored = await AsyncStorage.getItem(NERVE_URL_KEY);
      if (stored) set({ nerveUrl: stored });
    } catch {
      // ignore
    }
  },
}));
