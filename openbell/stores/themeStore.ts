import { create } from "zustand";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "@/constants/colors";
import { darkColors } from "@/constants/darkColors";
import { themes, themeMap, type ThemeColors } from "@/constants/themes";

type ThemeMode = "light" | "dark";

const THEME_KEY = "openclaw_active_theme";

interface ThemeState {
  mode: ThemeMode;
  theme: ThemeColors;
  activeThemeKey: string;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setTheme: (key: string) => void;
  loadPersisted: () => Promise<void>;
}

function getSystemTheme(): ThemeMode {
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

function resolveTheme(key: string): { mode: ThemeMode; theme: ThemeColors } {
  // Check named themes first
  const def = themeMap.get(key);
  if (def) {
    return { mode: def.isDark ? "dark" : "light", theme: def.colors };
  }
  // Fallback to legacy light/dark
  if (key === "dark") return { mode: "dark", theme: darkColors };
  return { mode: "light", theme: colors };
}

const systemDefault = getSystemTheme();

export const useThemeStore = create<ThemeState>((set) => ({
  mode: systemDefault,
  theme: systemDefault === "dark" ? darkColors : colors,
  activeThemeKey: systemDefault === "dark" ? "midnight" : "light",

  setMode: (mode) => {
    const key = mode === "dark" ? "midnight" : "light";
    const resolved = resolveTheme(key);
    set({ mode: resolved.mode, theme: resolved.theme, activeThemeKey: key });
    AsyncStorage.setItem(THEME_KEY, key);
  },

  toggleMode: () =>
    set((s) => {
      const key = s.mode === "dark" ? "light" : "midnight";
      const resolved = resolveTheme(key);
      AsyncStorage.setItem(THEME_KEY, key);
      return { mode: resolved.mode, theme: resolved.theme, activeThemeKey: key };
    }),

  setTheme: (key) => {
    const resolved = resolveTheme(key);
    set({ mode: resolved.mode, theme: resolved.theme, activeThemeKey: key });
    AsyncStorage.setItem(THEME_KEY, key);
  },

  loadPersisted: async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_KEY);
      if (stored) {
        const resolved = resolveTheme(stored);
        set({ mode: resolved.mode, theme: resolved.theme, activeThemeKey: stored });
      }
    } catch {
      // ignore
    }
  },
}));

/** Re-export for convenience */
export { themes } from "@/constants/themes";
