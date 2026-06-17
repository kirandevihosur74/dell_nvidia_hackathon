import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LLMProvider } from "@/types/settings";
import {
  setTradingBaseUrl,
  setTradingProvider,
  FINTELLECT_CLOUD_URL,
} from "@/services/marketData";

export type VoiceProfileOption =
  | "auto"
  | "general" | "technical" | "warning" | "discovery" | "success" | "professional"
  | "fisayo" | "dayo" | "olaniyi" | "paulina" | "dr_abebe" | "muyiwa" | "victor";

const NERVE_URL_KEY = "openclaw_nerve_url";

// Backend the app talks to for market data + grounded asset analysis:
//   "gb10"             -> existing GB10 deployment, local Nemotron via Ollama
//   "local_openrouter" -> a locally deployed backend using the OpenRouter mirror
//   "fintellect"       -> the shared Fintellect cloud backend (market data only)
export type InferenceMode = "gb10" | "local_openrouter" | "fintellect";

const INFERENCE_MODE_KEY = "inference_mode";
const GB10_URL_KEY = "inference_gb10_url";
const LOCAL_URL_KEY = "inference_local_url";
const FINTELLECT_URL_KEY = "inference_fintellect_url";

const DEFAULT_GB10_URL = "http://localhost:5001";
const DEFAULT_LOCAL_URL = "http://localhost:5001";
const DEFAULT_FINTELLECT_URL = FINTELLECT_CLOUD_URL;

// Which inference provider each backend serves analysis with:
//   gb10            -> local Nemotron (Ollama)
//   local_openrouter / fintellect -> OpenRouter Nemotron mirror (no local GPU)
function providerForMode(mode: InferenceMode): "local" | "openrouter" {
  return mode === "gb10" ? "local" : "openrouter";
}

function urlForMode(
  mode: InferenceMode,
  urls: { gb10Url: string; localUrl: string; fintellectUrl: string }
): string {
  if (mode === "gb10") return urls.gb10Url;
  if (mode === "local_openrouter") return urls.localUrl;
  return urls.fintellectUrl;
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
  fintellectUrl: string;

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
  setFintellectUrl: (url: string) => Promise<void>;
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
  fintellectUrl: DEFAULT_FINTELLECT_URL,

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
    const { gb10Url, localUrl, fintellectUrl } = useSettingsStore.getState();
    const url = urlForMode(mode, { gb10Url, localUrl, fintellectUrl });
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

  setFintellectUrl: async (url) => {
    const clean = url.replace(/\/+$/, "");
    set({ fintellectUrl: clean });
    await AsyncStorage.setItem(FINTELLECT_URL_KEY, clean);
    if (useSettingsStore.getState().inferenceMode === "fintellect") {
      await setTradingBaseUrl(clean);
    }
  },

  loadInferenceConfig: async () => {
    try {
      const [mode, gb10, local, fintellect] = await Promise.all([
        AsyncStorage.getItem(INFERENCE_MODE_KEY),
        AsyncStorage.getItem(GB10_URL_KEY),
        AsyncStorage.getItem(LOCAL_URL_KEY),
        AsyncStorage.getItem(FINTELLECT_URL_KEY),
      ]);
      const m = (mode as InferenceMode) || "gb10";
      const gb10Url = gb10 || DEFAULT_GB10_URL;
      const localUrl = local || DEFAULT_LOCAL_URL;
      const fintellectUrl = fintellect || DEFAULT_FINTELLECT_URL;
      set({ inferenceMode: m, gb10Url, localUrl, fintellectUrl });
      // Re-apply persisted selection to the trading service on app start.
      await setTradingBaseUrl(urlForMode(m, { gb10Url, localUrl, fintellectUrl }));
      await setTradingProvider(providerForMode(m));
    } catch {
      // ignore
    }
  },
}));
