import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Onboarding flow data store (ported from onboardingx5). Holds the multi-step
 * wizard progress and the user's collected preferences. Separate from the app's
 * gateway onboarding gate in @/stores/onboardingStore (which only tracks the
 * single `completed` flag used for routing).
 */

export type InvestmentGoal = "generate" | "house" | "wedding" | "learning";
export type InvestmentType = "etfs" | "bonds" | "crypto" | "options" | "stocks" | "commodities" | "forex";
export type RiskLevel = "conservative" | "moderate" | "aggressive";

export interface Strategy {
  id: string;
  name: string;
  description: string;
  allocation: Record<string, number>;
  riskLevel: string;
  expectedReturn: string;
  timeHorizon: string;
  volatility: string;
}

export interface OnboardingState {
  currentStep: number;
  isOnboardingComplete: boolean;

  investmentGoal: InvestmentGoal | null;
  investmentTypes: InvestmentType[];
  riskLevel: RiskLevel | null;
  selectedStrategy: Strategy | null;

  followedInfluencers: string[];
  followedAnalysts: string[];
  followedChannels: string[];

  notificationPreferences: {
    learning: boolean;
    market: boolean;
    social: boolean;
    achievements: boolean;
    frequency: "realtime" | "daily" | "weekly" | "important";
  };

  setCurrentStep: (step: number) => void;
  resetCurrentStep: (step: number) => void;
  setInvestmentGoal: (goal: InvestmentGoal) => void;
  toggleInvestmentType: (type: InvestmentType) => void;
  setRiskLevel: (level: RiskLevel) => void;
  setSelectedStrategy: (strategy: Strategy) => void;
  setNotificationPreferences: (preferences: Partial<OnboardingState["notificationPreferences"]>) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      currentStep: 0,
      isOnboardingComplete: false,
      investmentGoal: null,
      investmentTypes: [],
      riskLevel: null,
      selectedStrategy: null,
      followedInfluencers: [],
      followedAnalysts: [],
      followedChannels: [],
      notificationPreferences: {
        learning: true,
        market: true,
        social: true,
        achievements: true,
        frequency: "daily",
      },

      setCurrentStep: (step) => set({ currentStep: step }),
      resetCurrentStep: (step) => set({ currentStep: step }),
      setInvestmentGoal: (goal) => set({ investmentGoal: goal }),
      toggleInvestmentType: (type) =>
        set((state) => ({
          investmentTypes: state.investmentTypes.includes(type)
            ? state.investmentTypes.filter((t) => t !== type)
            : [...state.investmentTypes, type],
        })),
      setRiskLevel: (level) => set({ riskLevel: level }),
      setSelectedStrategy: (strategy) => set({ selectedStrategy: strategy }),
      setNotificationPreferences: (preferences) =>
        set((state) => ({
          notificationPreferences: { ...state.notificationPreferences, ...preferences },
        })),
      completeOnboarding: () => set({ isOnboardingComplete: true }),
      resetOnboarding: () =>
        set({
          currentStep: 0,
          isOnboardingComplete: false,
          investmentGoal: null,
          investmentTypes: [],
          riskLevel: null,
          selectedStrategy: null,
          followedInfluencers: [],
          followedAnalysts: [],
          followedChannels: [],
          notificationPreferences: {
            learning: true,
            market: true,
            social: true,
            achievements: true,
            frequency: "daily",
          },
        }),
    }),
    {
      name: "onboarding-flow-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
