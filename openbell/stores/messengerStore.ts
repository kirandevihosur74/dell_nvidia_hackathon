import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  MessengerChannel,
  MessengerMessage,
  MessengerUser,
  TypingUser,
  MessengerReaction,
  PresenceStatus,
} from "@/types/messenger";

const CHANNELS_STORAGE_KEY = "messenger_channels";
const TYPING_EXPIRY_MS = 4000;

// ─── Message Map: channelId → messages ───────────────────────────────────────

type MessageMap = Record<string, MessengerMessage[]>;

interface MessengerState {
  // Channels
  channels: MessengerChannel[];
  activeChannelId: string | null;
  activeThreadId: string | null;

  // Messages (keyed by channelId for efficient lookup)
  messagesByChannel: MessageMap;
  threadMessages: MessengerMessage[]; // replies for activeThreadId
  hasMoreMessages: Record<string, boolean>;

  // Users & Presence
  users: MessengerUser[];
  currentUserId: string | null;

  // Typing
  typingUsers: TypingUser[];

  // Loading
  isLoadingChannels: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;

  // ─── Channel Actions ─────────────────────────────────────────────────────

  setChannels: (channels: MessengerChannel[]) => void;
  addChannel: (channel: MessengerChannel) => void;
  updateChannel: (id: string, updates: Partial<MessengerChannel>) => void;
  removeChannel: (id: string) => void;
  setActiveChannel: (id: string | null) => void;
  setActiveThread: (messageId: string | null) => void;
  incrementUnread: (channelId: string) => void;
  clearUnread: (channelId: string) => void;
  getTotalUnread: () => number;

  // ─── Message Actions ─────────────────────────────────────────────────────

  setMessages: (channelId: string, messages: MessengerMessage[]) => void;
  prependMessages: (channelId: string, messages: MessengerMessage[]) => void;
  addMessage: (message: MessengerMessage) => void;
  addOptimisticMessage: (message: MessengerMessage) => void;
  confirmMessage: (clientMessageId: string, serverMessage: MessengerMessage) => void;
  failMessage: (clientMessageId: string) => void;
  updateMessage: (messageId: string, updates: Partial<MessengerMessage>) => void;
  removeMessage: (messageId: string, channelId: string) => void;
  setHasMore: (channelId: string, hasMore: boolean) => void;

  // ─── Thread Actions ──────────────────────────────────────────────────────

  setThreadMessages: (messages: MessengerMessage[]) => void;
  addThreadMessage: (message: MessengerMessage) => void;

  // ─── Reaction Actions ────────────────────────────────────────────────────

  updateReactions: (messageId: string, channelId: string, reactions: MessengerReaction[]) => void;

  // ─── User/Presence Actions ───────────────────────────────────────────────

  setUsers: (users: MessengerUser[]) => void;
  setCurrentUserId: (id: string) => void;
  updatePresence: (userId: string, presence: PresenceStatus) => void;
  updatePresenceBulk: (updates: Array<{ userId: string; presence: PresenceStatus }>) => void;

  // ─── Typing Actions ──────────────────────────────────────────────────────

  addTypingUser: (user: TypingUser) => void;
  removeTypingUser: (userId: string, channelId: string) => void;
  cleanExpiredTyping: () => void;

  // ─── Loading Actions ─────────────────────────────────────────────────────

  setIsLoadingChannels: (loading: boolean) => void;
  setIsLoadingMessages: (loading: boolean) => void;
  setIsSending: (sending: boolean) => void;

  // ─── Persistence ─────────────────────────────────────────────────────────

  loadFromStorage: () => Promise<void>;
  persistChannels: () => Promise<void>;

  // ─── Reset ───────────────────────────────────────────────────────────────

  reset: () => void;
}

export const useMessengerStore = create<MessengerState>((set, get) => ({
  channels: [],
  activeChannelId: null,
  activeThreadId: null,
  messagesByChannel: {},
  threadMessages: [],
  hasMoreMessages: {},
  users: [],
  currentUserId: null,
  typingUsers: [],
  isLoadingChannels: false,
  isLoadingMessages: false,
  isSending: false,

  // ─── Channels ──────────────────────────────────────────────────────────────

  setChannels: (channels) => {
    set({ channels });
    get().persistChannels();
  },

  addChannel: (channel) => {
    set((s) => {
      if (s.channels.some((c) => c.id === channel.id)) return s;
      return { channels: [...s.channels, channel] };
    });
    get().persistChannels();
  },

  updateChannel: (id, updates) => {
    set((s) => ({
      channels: s.channels.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
    get().persistChannels();
  },

  removeChannel: (id) => {
    set((s) => ({
      channels: s.channels.filter((c) => c.id !== id),
      activeChannelId: s.activeChannelId === id ? null : s.activeChannelId,
    }));
    get().persistChannels();
  },

  setActiveChannel: (id) => {
    set({ activeChannelId: id, activeThreadId: null, threadMessages: [] });
    if (id) get().clearUnread(id);
  },

  setActiveThread: (messageId) => {
    set({ activeThreadId: messageId, threadMessages: [] });
  },

  incrementUnread: (channelId) => {
    if (get().activeChannelId === channelId) return;
    set((s) => ({
      channels: s.channels.map((c) =>
        c.id === channelId ? { ...c, unreadCount: c.unreadCount + 1 } : c
      ),
    }));
    get().persistChannels();
  },

  clearUnread: (channelId) => {
    set((s) => ({
      channels: s.channels.map((c) =>
        c.id === channelId ? { ...c, unreadCount: 0 } : c
      ),
    }));
    get().persistChannels();
  },

  getTotalUnread: () => get().channels.reduce((sum, c) => sum + c.unreadCount, 0),

  // ─── Messages ──────────────────────────────────────────────────────────────

  setMessages: (channelId, messages) => {
    set((s) => ({
      messagesByChannel: { ...s.messagesByChannel, [channelId]: messages },
    }));
  },

  prependMessages: (channelId, messages) => {
    set((s) => {
      const existing = s.messagesByChannel[channelId] || [];
      const existingIds = new Set(existing.map((m) => m.id));
      const newMsgs = messages.filter((m) => !existingIds.has(m.id));
      return {
        messagesByChannel: {
          ...s.messagesByChannel,
          [channelId]: [...newMsgs, ...existing],
        },
      };
    });
  },

  addMessage: (message) => {
    set((s) => {
      const channelId = message.channelId;
      const existing = s.messagesByChannel[channelId] || [];
      if (existing.some((m) => m.id === message.id)) return s;
      return {
        messagesByChannel: {
          ...s.messagesByChannel,
          [channelId]: [...existing, message],
        },
      };
    });
  },

  addOptimisticMessage: (message) => {
    set((s) => {
      const channelId = message.channelId;
      const existing = s.messagesByChannel[channelId] || [];
      return {
        messagesByChannel: {
          ...s.messagesByChannel,
          [channelId]: [...existing, message],
        },
        isSending: true,
      };
    });
  },

  confirmMessage: (clientMessageId, serverMessage) => {
    set((s) => {
      const channelId = serverMessage.channelId;
      const existing = s.messagesByChannel[channelId] || [];
      return {
        messagesByChannel: {
          ...s.messagesByChannel,
          [channelId]: existing.map((m) =>
            m.clientMessageId === clientMessageId ? serverMessage : m
          ),
        },
        isSending: false,
      };
    });
  },

  failMessage: (clientMessageId) => {
    set((s) => {
      const updated: MessageMap = {};
      for (const [chId, msgs] of Object.entries(s.messagesByChannel)) {
        updated[chId] = msgs.map((m) =>
          m.clientMessageId === clientMessageId ? { ...m, status: "error" as const } : m
        );
      }
      return { messagesByChannel: updated, isSending: false };
    });
  },

  updateMessage: (messageId, updates) => {
    set((s) => {
      const updated: MessageMap = {};
      for (const [chId, msgs] of Object.entries(s.messagesByChannel)) {
        updated[chId] = msgs.map((m) =>
          m.id === messageId ? { ...m, ...updates } : m
        );
      }
      return { messagesByChannel: updated };
    });
  },

  removeMessage: (messageId, channelId) => {
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: (s.messagesByChannel[channelId] || []).filter(
          (m) => m.id !== messageId
        ),
      },
    }));
  },

  setHasMore: (channelId, hasMore) => {
    set((s) => ({
      hasMoreMessages: { ...s.hasMoreMessages, [channelId]: hasMore },
    }));
  },

  // ─── Threads ───────────────────────────────────────────────────────────────

  setThreadMessages: (messages) => set({ threadMessages: messages }),

  addThreadMessage: (message) => {
    set((s) => {
      if (s.threadMessages.some((m) => m.id === message.id)) return s;
      return { threadMessages: [...s.threadMessages, message] };
    });
  },

  // ─── Reactions ─────────────────────────────────────────────────────────────

  updateReactions: (messageId, channelId, reactions) => {
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: (s.messagesByChannel[channelId] || []).map((m) =>
          m.id === messageId ? { ...m, reactions } : m
        ),
      },
    }));
  },

  // ─── Users / Presence ──────────────────────────────────────────────────────

  setUsers: (users) => set({ users }),
  setCurrentUserId: (id) => set({ currentUserId: id }),

  updatePresence: (userId, presence) => {
    set((s) => ({
      users: s.users.map((u) => (u.id === userId ? { ...u, presence } : u)),
    }));
  },

  updatePresenceBulk: (updates) => {
    set((s) => {
      const map = new Map(updates.map((u) => [u.userId, u.presence]));
      return {
        users: s.users.map((u) => {
          const p = map.get(u.id);
          return p ? { ...u, presence: p } : u;
        }),
      };
    });
  },

  // ─── Typing ────────────────────────────────────────────────────────────────

  addTypingUser: (user) => {
    set((s) => {
      const filtered = s.typingUsers.filter(
        (t) => !(t.userId === user.userId && t.channelId === user.channelId)
      );
      return { typingUsers: [...filtered, user] };
    });
  },

  removeTypingUser: (userId, channelId) => {
    set((s) => ({
      typingUsers: s.typingUsers.filter(
        (t) => !(t.userId === userId && t.channelId === channelId)
      ),
    }));
  },

  cleanExpiredTyping: () => {
    const now = Date.now();
    set((s) => ({
      typingUsers: s.typingUsers.filter((t) => t.expiresAt > now),
    }));
  },

  // ─── Loading ───────────────────────────────────────────────────────────────

  setIsLoadingChannels: (loading) => set({ isLoadingChannels: loading }),
  setIsLoadingMessages: (loading) => set({ isLoadingMessages: loading }),
  setIsSending: (sending) => set({ isSending: sending }),

  // ─── Persistence ───────────────────────────────────────────────────────────

  loadFromStorage: async () => {
    try {
      const json = await AsyncStorage.getItem(CHANNELS_STORAGE_KEY);
      if (json) {
        const channels = JSON.parse(json) as MessengerChannel[];
        set({ channels });
      }
    } catch {
      // ignore
    }
  },

  persistChannels: async () => {
    try {
      await AsyncStorage.setItem(
        CHANNELS_STORAGE_KEY,
        JSON.stringify(get().channels)
      );
    } catch {
      // ignore
    }
  },

  // ─── Reset ─────────────────────────────────────────────────────────────────

  reset: () =>
    set({
      channels: [],
      activeChannelId: null,
      activeThreadId: null,
      messagesByChannel: {},
      threadMessages: [],
      hasMoreMessages: {},
      users: [],
      currentUserId: null,
      typingUsers: [],
      isLoadingChannels: false,
      isLoadingMessages: false,
      isSending: false,
    }),
}));
