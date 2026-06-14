import { create } from 'zustand';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'stream_started' | 'stream_ended' | 'analysis_complete' | 'viewer_milestone' | 'system';
  timestamp: string;
  read: boolean;
  data?: Record<string, unknown>;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  pushToken: string | null;
  permissionGranted: boolean;

  addNotification: (notification: AppNotification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  setPushToken: (token: string | null) => void;
  setPermissionGranted: (granted: boolean) => void;
}

export const useStreamIONotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  pushToken: null,
  permissionGranted: false,

  addNotification: (notification) =>
    set((state) => {
      const notifications = [notification, ...state.notifications].slice(0, 50);
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      };
    }),

  markRead: (id) =>
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      );
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      };
    }),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  removeNotification: (id) =>
    set((state) => {
      const notifications = state.notifications.filter((n) => n.id !== id);
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      };
    }),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
  setPushToken: (pushToken) => set({ pushToken }),
  setPermissionGranted: (permissionGranted) => set({ permissionGranted }),
}));
