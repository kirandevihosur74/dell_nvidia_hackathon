import { create } from "zustand";
import { gatewayClient } from "@/services/gateway";
import type { GatewayFileEntry, GatewayFileWithContent } from "@/types/gateway";

export type WorkspaceTab = "files" | "memory" | "config" | "crons" | "skills";

/** Well-known agent config files shown in the Config sub-tab. */
export const CONFIG_FILES = [
  "SOUL.md",
  "TOOLS.md",
  "USER.md",
  "AGENTS.md",
  "HEARTBEAT.md",
  "IDENTITY.md",
] as const;

interface WorkspaceState {
  files: GatewayFileEntry[];
  activeFile: GatewayFileWithContent | null;
  activeTab: WorkspaceTab;
  dirty: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;

  setActiveTab: (tab: WorkspaceTab) => void;
  listFiles: (agentId: string) => Promise<void>;
  openFile: (agentId: string, name: string) => Promise<void>;
  saveFile: (agentId: string, name: string, content: string) => Promise<void>;
  setDirty: (dirty: boolean) => void;
  clearFile: () => void;
  clearError: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  files: [],
  activeFile: null,
  activeTab: "files",
  dirty: false,
  loading: false,
  saving: false,
  error: null,

  setActiveTab: (tab) => set({ activeTab: tab }),

  listFiles: async (agentId) => {
    set({ loading: true, error: null });
    try {
      const result = await gatewayClient.filesList(agentId);
      const files = Array.isArray(result) ? result : [];
      set({ files, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list files";
      set({ loading: false, error: message });
    }
  },

  openFile: async (agentId, name) => {
    set({ loading: true, error: null, dirty: false });
    try {
      const file = await gatewayClient.filesGet(agentId, name);
      set({ activeFile: file, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open file";
      set({ loading: false, error: message });
    }
  },

  saveFile: async (agentId, name, content) => {
    set({ saving: true, error: null });
    try {
      await gatewayClient.filesSet(agentId, name, content);
      // Update the active file content in state
      const { activeFile } = get();
      if (activeFile && activeFile.name === name) {
        set({ activeFile: { ...activeFile, content }, saving: false, dirty: false });
      } else {
        set({ saving: false, dirty: false });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save file";
      set({ saving: false, error: message });
    }
  },

  setDirty: (dirty) => set({ dirty }),
  clearFile: () => set({ activeFile: null, dirty: false }),
  clearError: () => set({ error: null }),
}));
