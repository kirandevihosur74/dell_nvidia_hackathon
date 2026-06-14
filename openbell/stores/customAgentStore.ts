import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "openclaw_custom_agents";

export interface CustomAgent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  categoryId: string;
  sandboxMode: "read-only" | "workspace-write";
  clonedFrom?: string;
  createdAt: string;
  updatedAt: string;
}

interface CustomAgentState {
  agents: CustomAgent[];
  loaded: boolean;

  loadFromStorage: () => Promise<void>;
  addAgent: (agent: Omit<CustomAgent, "id" | "createdAt" | "updatedAt">) => CustomAgent;
  updateAgent: (id: string, updates: Partial<Pick<CustomAgent, "name" | "description" | "systemPrompt" | "categoryId" | "sandboxMode">>) => void;
  deleteAgent: (id: string) => void;
  getAgent: (id: string) => CustomAgent | undefined;
}

function persist(agents: CustomAgent[]) {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(agents)).catch(() => {});
}

export const useCustomAgentStore = create<CustomAgentState>((set, get) => ({
  agents: [],
  loaded: false,

  loadFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        set({ agents: JSON.parse(raw), loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  addAgent: (input) => {
    const now = new Date().toISOString();
    const agent: CustomAgent = {
      ...input,
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => {
      const updated = [...s.agents, agent];
      persist(updated);
      return { agents: updated };
    });
    return agent;
  },

  updateAgent: (id, updates) => {
    set((s) => {
      const updated = s.agents.map((a) =>
        a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
      );
      persist(updated);
      return { agents: updated };
    });
  },

  deleteAgent: (id) => {
    set((s) => {
      const updated = s.agents.filter((a) => a.id !== id);
      persist(updated);
      return { agents: updated };
    });
  },

  getAgent: (id) => {
    return get().agents.find((a) => a.id === id);
  },
}));
