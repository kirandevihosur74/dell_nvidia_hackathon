import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { OpenClawChannel } from "@/types/openclaw";

const CHANNELS_KEY = "openclaw_channels";

interface ChannelState {
  channels: OpenClawChannel[];
  activeChannelId: string | null;
  activeThreadId: string | null;

  setChannels: (channels: OpenClawChannel[]) => void;
  addChannel: (channel: OpenClawChannel) => void;
  updateChannel: (id: string, updates: Partial<OpenClawChannel>) => void;
  removeChannel: (id: string) => void;
  setActiveChannel: (id: string | null) => void;
  setActiveThread: (messageId: string | null) => void;

  incrementUnread: (channelId: string) => void;
  clearUnread: (channelId: string) => void;
  getTotalUnread: () => number;

  pinMessage: (channelId: string, messageId: string) => void;
  unpinMessage: (channelId: string, messageId: string) => void;

  loadFromStorage: () => Promise<void>;
  persistToStorage: () => Promise<void>;
}

export const useChannelStore = create<ChannelState>((set, get) => ({
  channels: [],
  activeChannelId: null,
  activeThreadId: null,

  setChannels: (channels) => {
    set({ channels });
    get().persistToStorage();
  },

  addChannel: (channel) => {
    set((s) => ({ channels: [...s.channels, channel] }));
    get().persistToStorage();
  },

  updateChannel: (id, updates) => {
    set((s) => ({
      channels: s.channels.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
    get().persistToStorage();
  },

  removeChannel: (id) => {
    set((s) => ({
      channels: s.channels.filter((c) => c.id !== id),
      activeChannelId: s.activeChannelId === id ? null : s.activeChannelId,
    }));
    get().persistToStorage();
  },

  setActiveChannel: (id) => {
    set({ activeChannelId: id, activeThreadId: null });
    if (id) get().clearUnread(id);
  },

  setActiveThread: (messageId) => set({ activeThreadId: messageId }),

  incrementUnread: (channelId) => {
    const { activeChannelId } = get();
    // Don't increment if we're already viewing this channel
    if (activeChannelId === channelId) return;
    set((s) => ({
      channels: s.channels.map((c) =>
        c.id === channelId ? { ...c, unreadCount: c.unreadCount + 1 } : c
      ),
    }));
    get().persistToStorage();
  },

  clearUnread: (channelId) => {
    set((s) => ({
      channels: s.channels.map((c) =>
        c.id === channelId ? { ...c, unreadCount: 0 } : c
      ),
    }));
    get().persistToStorage();
  },

  getTotalUnread: () => {
    return get().channels.reduce((sum, c) => sum + c.unreadCount, 0);
  },

  pinMessage: (channelId, messageId) => {
    set((s) => ({
      channels: s.channels.map((c) =>
        c.id === channelId && !c.pinnedMessageIds.includes(messageId)
          ? { ...c, pinnedMessageIds: [...c.pinnedMessageIds, messageId] }
          : c
      ),
    }));
    get().persistToStorage();
  },

  unpinMessage: (channelId, messageId) => {
    set((s) => ({
      channels: s.channels.map((c) =>
        c.id === channelId
          ? { ...c, pinnedMessageIds: c.pinnedMessageIds.filter((id) => id !== messageId) }
          : c
      ),
    }));
    get().persistToStorage();
  },

  loadFromStorage: async () => {
    try {
      const json = await AsyncStorage.getItem(CHANNELS_KEY);
      if (json) {
        const channels = JSON.parse(json) as OpenClawChannel[];
        set({ channels });
      }
    } catch {
      // ignore
    }
  },

  persistToStorage: async () => {
    const { channels } = get();
    try {
      await AsyncStorage.setItem(CHANNELS_KEY, JSON.stringify(channels));
    } catch {
      // ignore
    }
  },
}));
