import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CapturePreference,
  QualityPreset,
  AIFeature,
  NotificationType,
  Permission,
} from '@/types/streamio';
import { useStreamIOStreamStore } from '@/stores/streamio/streamStore';

interface OnboardingState {
  currentStep: number;
  isOnboardingComplete: boolean;
  totalSteps: number;

  // Step selections
  permissionsGranted: Permission[];
  selectedCaptureSource: CapturePreference;
  selectedQuality: QualityPreset;
  enabledAIFeatures: AIFeature[];
  enabledNotifications: NotificationType[];

  // Actions
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;

  // Selection actions
  togglePermission: (permission: Permission) => void;
  setCaptureSource: (source: CapturePreference) => void;
  setQuality: (quality: QualityPreset) => void;
  toggleAIFeature: (feature: AIFeature) => void;
  toggleNotification: (type: NotificationType) => void;
}

const ALL_AI_FEATURES: AIFeature[] = ['propertyAnalysis', 'tradingAnalysis', 'tts', 'stt'];
const ALL_NOTIFICATIONS: NotificationType[] = ['streamAlerts', 'analysisComplete', 'viewerMilestones', 'system'];

export const useStreamIOOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      currentStep: 0,
      isOnboardingComplete: false,
      totalSteps: 6,

      permissionsGranted: [],
      selectedCaptureSource: 'screen',
      selectedQuality: 'medium',
      enabledAIFeatures: [...ALL_AI_FEATURES],
      enabledNotifications: [...ALL_NOTIFICATIONS],

      setCurrentStep: (step) => set({ currentStep: step }),

      nextStep: () => {
        const { currentStep, totalSteps } = get();
        if (currentStep < totalSteps - 1) {
          set({ currentStep: currentStep + 1 });
        } else {
          get().completeOnboarding();
        }
      },

      previousStep: () => {
        const { currentStep } = get();
        if (currentStep > 0) {
          set({ currentStep: currentStep - 1 });
        }
      },

      skipOnboarding: () => {
        // Apply defaults
        set({
          selectedCaptureSource: 'screen',
          selectedQuality: 'medium',
          enabledAIFeatures: [...ALL_AI_FEATURES],
          enabledNotifications: [...ALL_NOTIFICATIONS],
          isOnboardingComplete: true,
        });
        // Apply defaults to stream store config
        const streamStore = useStreamIOStreamStore.getState();
        streamStore.setCaptureSource('screen');
      },

      completeOnboarding: () => {
        const state = get();
        set({ isOnboardingComplete: true });

        // Apply selections to stream store
        const streamStore = useStreamIOStreamStore.getState();
        streamStore.setCaptureSource(state.selectedCaptureSource);
      },

      resetOnboarding: () => set({
        currentStep: 0,
        isOnboardingComplete: false,
        permissionsGranted: [],
        selectedCaptureSource: 'screen',
        selectedQuality: 'medium',
        enabledAIFeatures: [...ALL_AI_FEATURES],
        enabledNotifications: [...ALL_NOTIFICATIONS],
      }),

      togglePermission: (permission) =>
        set((state) => ({
          permissionsGranted: state.permissionsGranted.includes(permission)
            ? state.permissionsGranted.filter((p) => p !== permission)
            : [...state.permissionsGranted, permission],
        })),

      setCaptureSource: (source) => set({ selectedCaptureSource: source }),
      setQuality: (quality) => set({ selectedQuality: quality }),

      toggleAIFeature: (feature) =>
        set((state) => ({
          enabledAIFeatures: state.enabledAIFeatures.includes(feature)
            ? state.enabledAIFeatures.filter((f) => f !== feature)
            : [...state.enabledAIFeatures, feature],
        })),

      toggleNotification: (type) =>
        set((state) => ({
          enabledNotifications: state.enabledNotifications.includes(type)
            ? state.enabledNotifications.filter((n) => n !== type)
            : [...state.enabledNotifications, type],
        })),
    }),
    {
      name: 'streamio:onboarding',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
