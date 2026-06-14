import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  SlackWorkspace,
  SlackChannel,
  SlackBridge,
  SlackUserMapping,
} from "@/types/slack";

const WORKSPACES_KEY = "slack_workspaces";
const BRIDGES_KEY = "slack_bridges";

interface SlackState {
  // Workspaces
  workspaces: SlackWorkspace[];
  activeWorkspaceId: string | null;

  // Channel discovery (for bridge picker)
  availableChannels: SlackChannel[];
  isLoadingChannels: boolean;
  channelCursor: string | null;

  // Bridges
  bridges: SlackBridge[];

  // User mapping
  slackUsers: SlackUserMapping[];

  // OAuth
  isOAuthInProgress: boolean;
  oauthError: string | null;

  // ─── Workspace Actions ────────────────────────────────────────────────

  setWorkspaces: (workspaces: SlackWorkspace[]) => void;
  addWorkspace: (workspace: SlackWorkspace) => void;
  removeWorkspace: (teamId: string) => void;
  updateWorkspace: (teamId: string, updates: Partial<SlackWorkspace>) => void;
  setActiveWorkspace: (teamId: string | null) => void;

  // ─── Channel Discovery Actions ────────────────────────────────────────

  setAvailableChannels: (channels: SlackChannel[]) => void;
  appendAvailableChannels: (channels: SlackChannel[]) => void;
  setIsLoadingChannels: (loading: boolean) => void;
  setChannelCursor: (cursor: string | null) => void;
  clearAvailableChannels: () => void;

  // ─── Bridge Actions ───────────────────────────────────────────────────

  setBridges: (bridges: SlackBridge[]) => void;
  addBridge: (bridge: SlackBridge) => void;
  removeBridge: (messengerChannelId: string) => void;

  // ─── User Actions ─────────────────────────────────────────────────────

  setSlackUsers: (users: SlackUserMapping[]) => void;

  // ─── OAuth Actions ────────────────────────────────────────────────────

  setOAuthInProgress: (inProgress: boolean) => void;
  setOAuthError: (error: string | null) => void;

  // ─── Persistence ──────────────────────────────────────────────────────

  loadFromStorage: () => Promise<void>;
  persistWorkspaces: () => Promise<void>;
  persistBridges: () => Promise<void>;

  // ─── Helpers ──────────────────────────────────────────────────────────

  getWorkspaceById: (teamId: string) => SlackWorkspace | undefined;
  getBridgeForChannel: (messengerChannelId: string) => SlackBridge | undefined;
  isBridged: (slackChannelId: string) => boolean;

  // ─── Reset ────────────────────────────────────────────────────────────

  reset: () => void;
}

export const useSlackStore = create<SlackState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  availableChannels: [],
  isLoadingChannels: false,
  channelCursor: null,
  bridges: [],
  slackUsers: [],
  isOAuthInProgress: false,
  oauthError: null,

  // ─── Workspaces ────────────────────────────────────────────────────────────

  setWorkspaces: (workspaces) => {
    set({ workspaces });
    get().persistWorkspaces();
  },

  addWorkspace: (workspace) => {
    set((s) => {
      if (s.workspaces.some((w) => w.id === workspace.id)) {
        return {
          workspaces: s.workspaces.map((w) =>
            w.id === workspace.id ? { ...w, ...workspace } : w
          ),
        };
      }
      return { workspaces: [...s.workspaces, workspace] };
    });
    get().persistWorkspaces();
  },

  removeWorkspace: (teamId) => {
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.id !== teamId),
      activeWorkspaceId: s.activeWorkspaceId === teamId ? null : s.activeWorkspaceId,
      bridges: s.bridges.filter((b) => b.slackTeamId !== teamId),
    }));
    get().persistWorkspaces();
    get().persistBridges();
  },

  updateWorkspace: (teamId, updates) => {
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === teamId ? { ...w, ...updates } : w
      ),
    }));
    get().persistWorkspaces();
  },

  setActiveWorkspace: (teamId) => set({ activeWorkspaceId: teamId }),

  // ─── Channel Discovery ─────────────────────────────────────────────────────

  setAvailableChannels: (channels) => set({ availableChannels: channels }),

  appendAvailableChannels: (channels) => {
    set((s) => {
      const existingIds = new Set(s.availableChannels.map((c) => c.id));
      const newChannels = channels.filter((c) => !existingIds.has(c.id));
      return { availableChannels: [...s.availableChannels, ...newChannels] };
    });
  },

  setIsLoadingChannels: (loading) => set({ isLoadingChannels: loading }),
  setChannelCursor: (cursor) => set({ channelCursor: cursor }),

  clearAvailableChannels: () =>
    set({ availableChannels: [], channelCursor: null }),

  // ─── Bridges ───────────────────────────────────────────────────────────────

  setBridges: (bridges) => {
    set({ bridges });
    get().persistBridges();
  },

  addBridge: (bridge) => {
    set((s) => {
      if (s.bridges.some((b) => b.messengerChannelId === bridge.messengerChannelId)) {
        return s;
      }
      return { bridges: [...s.bridges, bridge] };
    });
    get().persistBridges();
  },

  removeBridge: (messengerChannelId) => {
    set((s) => ({
      bridges: s.bridges.filter((b) => b.messengerChannelId !== messengerChannelId),
    }));
    get().persistBridges();
  },

  // ─── Users ─────────────────────────────────────────────────────────────────

  setSlackUsers: (users) => set({ slackUsers: users }),

  // ─── OAuth ─────────────────────────────────────────────────────────────────

  setOAuthInProgress: (inProgress) => set({ isOAuthInProgress: inProgress }),
  setOAuthError: (error) => set({ oauthError: error }),

  // ─── Persistence ───────────────────────────────────────────────────────────

  loadFromStorage: async () => {
    try {
      const [wsJson, brJson] = await Promise.all([
        AsyncStorage.getItem(WORKSPACES_KEY),
        AsyncStorage.getItem(BRIDGES_KEY),
      ]);
      if (wsJson) set({ workspaces: JSON.parse(wsJson) });
      if (brJson) set({ bridges: JSON.parse(brJson) });
    } catch {
      // ignore
    }
  },

  persistWorkspaces: async () => {
    try {
      await AsyncStorage.setItem(WORKSPACES_KEY, JSON.stringify(get().workspaces));
    } catch {
      // ignore
    }
  },

  persistBridges: async () => {
    try {
      await AsyncStorage.setItem(BRIDGES_KEY, JSON.stringify(get().bridges));
    } catch {
      // ignore
    }
  },

  // ─── Helpers ───────────────────────────────────────────────────────────────

  getWorkspaceById: (teamId) => get().workspaces.find((w) => w.id === teamId),

  getBridgeForChannel: (messengerChannelId) =>
    get().bridges.find((b) => b.messengerChannelId === messengerChannelId),

  isBridged: (slackChannelId) =>
    get().bridges.some((b) => b.slackChannelId === slackChannelId),

  // ─── Reset ─────────────────────────────────────────────────────────────────

  reset: () =>
    set({
      workspaces: [],
      activeWorkspaceId: null,
      availableChannels: [],
      isLoadingChannels: false,
      channelCursor: null,
      bridges: [],
      slackUsers: [],
      isOAuthInProgress: false,
      oauthError: null,
    }),
}));
