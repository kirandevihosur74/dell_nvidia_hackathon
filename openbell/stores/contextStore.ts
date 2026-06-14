import { create } from "zustand";
import { gatewayClient } from "@/services/gateway";
import type { TokenUsage } from "@/types/gateway";

const POLL_INTERVAL = 10000; // 10 seconds

interface ContextState {
  usage: TokenUsage | null;
  loading: boolean;
  error: string | null;
  polling: boolean;

  fetchUsage: (sessionId: string) => Promise<void>;
  startPolling: (sessionId: string) => void;
  stopPolling: () => void;
  clearUsage: () => void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

export const useContextStore = create<ContextState>((set, get) => ({
  usage: null,
  loading: false,
  error: null,
  polling: false,

  fetchUsage: async (sessionId) => {
    if (!sessionId) return;
    set({ loading: true });
    try {
      const usage = await gatewayClient.tokensUsage(sessionId);
      set({ usage, loading: false, error: null });
    } catch (err) {
      // Token usage might not be supported — fail silently after first attempt
      const message = err instanceof Error ? err.message : "Failed to fetch usage";
      set({ loading: false, error: message });
    }
  },

  startPolling: (sessionId) => {
    const { stopPolling, fetchUsage } = get();
    stopPolling();
    set({ polling: true });
    fetchUsage(sessionId);
    pollTimer = setInterval(() => {
      if (gatewayClient.isConnected()) {
        fetchUsage(sessionId);
      }
    }, POLL_INTERVAL);
  },

  stopPolling: () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    set({ polling: false });
  },

  clearUsage: () => {
    const { stopPolling } = get();
    stopPolling();
    set({ usage: null, error: null });
  },
}));
