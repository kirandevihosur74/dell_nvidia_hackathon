import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StreamIOAuth, StreamIOSubscriptionTier } from '@/types/streamio';

interface StreamIOAuthState {
  currentAuth: StreamIOAuth | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  subscription: StreamIOSubscriptionTier;

  setAuth: (auth: StreamIOAuth) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useStreamIOAuthStore = create<StreamIOAuthState>()(
  persist(
    (set) => ({
      currentAuth: null,
      isAuthenticated: false,
      isLoading: false,
      subscription: 'free',

      setAuth: (auth) => {
        const isValid =
          auth.isAuthenticated &&
          (!auth.expiresAt || new Date(auth.expiresAt) > new Date());

        set({
          currentAuth: auth,
          isAuthenticated: isValid,
          subscription: auth.subscriptionTier || 'free',
        });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      logout: () =>
        set({
          currentAuth: null,
          isAuthenticated: false,
          subscription: 'free',
        }),
    }),
    {
      name: 'streamio:auth',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
