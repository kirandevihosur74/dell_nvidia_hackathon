import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { KeyPairInfo } from "@/types/encryption";

const ENCRYPTION_ENABLED_KEY = "openclaw_encryption_enabled";

interface EncryptionState {
  /** E2E encryption enabled globally */
  enabled: boolean;
  /** Per-gateway key info */
  keys: KeyPairInfo[];
  /** Safety number blocks for the currently selected gateway (for verification UI) */
  safetyNumberBlocks: string[] | null;
  /** Whether the current gateway's key is verified */
  isVerified: boolean;

  setEnabled: (enabled: boolean) => void;
  setKeys: (keys: KeyPairInfo[]) => void;
  updateKey: (gatewayId: string, updates: Partial<KeyPairInfo>) => void;
  removeKey: (gatewayId: string) => void;
  setSafetyNumberBlocks: (blocks: string[] | null) => void;
  setIsVerified: (verified: boolean) => void;
  loadFromStorage: () => Promise<void>;
}

export const useEncryptionStore = create<EncryptionState>((set) => ({
  enabled: false,
  keys: [],
  safetyNumberBlocks: null,
  isVerified: false,

  setEnabled: (enabled) => {
    set({ enabled });
    AsyncStorage.setItem(ENCRYPTION_ENABLED_KEY, JSON.stringify(enabled)).catch(() => {});
  },
  setKeys: (keys) => set({ keys }),
  updateKey: (gatewayId, updates) =>
    set((s) => ({
      keys: s.keys.map((k) =>
        k.gatewayId === gatewayId ? { ...k, ...updates } : k
      ),
    })),
  removeKey: (gatewayId) =>
    set((s) => ({
      keys: s.keys.filter((k) => k.gatewayId !== gatewayId),
    })),
  setSafetyNumberBlocks: (blocks) => set({ safetyNumberBlocks: blocks }),
  setIsVerified: (verified) => set({ isVerified: verified }),
  loadFromStorage: async () => {
    try {
      const json = await AsyncStorage.getItem(ENCRYPTION_ENABLED_KEY);
      if (json !== null) {
        set({ enabled: JSON.parse(json) });
      }
    } catch {
      // ignore
    }
  },
}));
