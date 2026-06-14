import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface OnboardingState {
  completed: boolean;
  ready: boolean;
  complete: () => void;
  skip: () => void;
  loadState: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  completed: false,
  ready: false,

  complete: () => {
    set({ completed: true });
    AsyncStorage.setItem("onboarding_completed", "true");
  },

  skip: () => {
    set({ completed: true });
    AsyncStorage.setItem("onboarding_completed", "true");
  },

  loadState: async () => {
    const completed = await AsyncStorage.getItem("onboarding_completed");
    set({ completed: completed === "true", ready: true });
  },
}));
