import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LLMProvider } from "@/types/settings";
import { setTradingBaseUrl, setTradingProvider } from "@/services/marketData";

export type VoiceProfileOption =
  | "auto"
  | "general" | "technical" | "warning" | "discovery" | "success" | "professional"
  | "fisayo" | "dayo" | "olaniyi" | "paulina" | "dr_abebe" | "muyiwa" | "victor";

const NERVE_URL_KEY = "openclaw_nerve_url";

// Inference backend for grounded asset analysis:
//   "gb10"             -> existing GB10 deployment, local Nemotron via Ollama
//   "local_openrouter" -> a locally deployed backend using the OpenRouter mirror
export type InferenceMode = "gb10" | "local_openrouter";

const INFERENCE_MODE_KEY = "inference_mode";
const GB10_URL_KEY = "inference_gb10_url";
const LOCAL_URL_KEY = "inference_local_url";

const DEFAULT_GB10_URL = "http://localhost:5001";
const DEFAULT_LOCAL_URL = "http://localhost:5001";

function providerForMode(mode: InferenceMode): "local" | "openrouter" {
  return mode === "gb10" ? "local" : "openrouter";
}

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

  inferenceMode: InferenceMode;
  gb10Url: string;
  localUrl: string;

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

  setInferenceMode: (mode: InferenceMode) => Promise<void>;
  setGb10Url: (url: string) => Promise<void>;
  setLocalUrl: (url: string) => Promise<void>;
  loadInferenceConfig: () => Promise<void>;
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

  inferenceMode: "gb10",
  gb10Url: DEFAULT_GB10_URL,
  localUrl: DEFAULT_LOCAL_URL,

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

  setInferenceMode: async (mode) => {
    set({ inferenceMode: mode });
    const { gb10Url, localUrl } = useSettingsStore.getState();
    const url = mode === "gb10" ? gb10Url : localUrl;
    await AsyncStorage.setItem(INFERENCE_MODE_KEY, mode);
    // Point the trading service at the right backend + tell it which model to use.
    await setTradingBaseUrl(url);
    await setTradingProvider(providerForMode(mode));
  },

  setGb10Url: async (url) => {
    const clean = url.replace(/\/+$/, "");
    set({ gb10Url: clean });
    await AsyncStorage.setItem(GB10_URL_KEY, clean);
    if (useSettingsStore.getState().inferenceMode === "gb10") {
      await setTradingBaseUrl(clean);
    }
  },

  setLocalUrl: async (url) => {
    const clean = url.replace(/\/+$/, "");
    set({ localUrl: clean });
    await AsyncStorage.setItem(LOCAL_URL_KEY, clean);
    if (useSettingsStore.getState().inferenceMode === "local_openrouter") {
      await setTradingBaseUrl(clean);
    }
  },

  loadInferenceConfig: async () => {
    try {
      const [mode, gb10, local] = await Promise.all([
        AsyncStorage.getItem(INFERENCE_MODE_KEY),
        AsyncStorage.getItem(GB10_URL_KEY),
        AsyncStorage.getItem(LOCAL_URL_KEY),
      ]);
      const m = (mode as InferenceMode) || "gb10";
      const gb10Url = gb10 || DEFAULT_GB10_URL;
      const localUrl = local || DEFAULT_LOCAL_URL;
      set({ inferenceMode: m, gb10Url, localUrl });
      // Re-apply persisted selection to the trading service on app start.
      await setTradingBaseUrl(m === "gb10" ? gb10Url : localUrl);
      await setTradingProvider(providerForMode(m));
    } catch {
      // ignore
    }
  },
}));
