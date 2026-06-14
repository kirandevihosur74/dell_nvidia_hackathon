import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AsanaTask } from "@/types/asana";

interface PendingAction {
  id: string;
  type: "move_task" | "create_task" | "update_task" | "delete_task";
  payload: Record<string, unknown>;
  createdAt: string;
}

interface OfflineState {
  isOffline: boolean;
  cachedTasks: AsanaTask[];
  pendingActions: PendingAction[];

  setOffline: (offline: boolean) => void;
  setCachedTasks: (tasks: AsanaTask[]) => void;
  addPendingAction: (action: Omit<PendingAction, "id" | "createdAt">) => void;
  removePendingAction: (id: string) => void;
  clearPendingActions: () => void;
  loadFromStorage: () => Promise<void>;
  persistToStorage: () => Promise<void>;
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isOffline: false,
  cachedTasks: [],
  pendingActions: [],

  setOffline: (offline) => set({ isOffline: offline }),

  setCachedTasks: (tasks) => {
    set({ cachedTasks: tasks });
    get().persistToStorage();
  },

  addPendingAction: (action) => {
    const newAction: PendingAction = {
      ...action,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ pendingActions: [...s.pendingActions, newAction] }));
    get().persistToStorage();
  },

  removePendingAction: (id) => {
    set((s) => ({ pendingActions: s.pendingActions.filter((a) => a.id !== id) }));
    get().persistToStorage();
  },

  clearPendingActions: () => {
    set({ pendingActions: [] });
    get().persistToStorage();
  },

  loadFromStorage: async () => {
    try {
      const [tasksJson, actionsJson] = await Promise.all([
        AsyncStorage.getItem("cached_tasks"),
        AsyncStorage.getItem("pending_actions"),
      ]);
      set({
        cachedTasks: tasksJson ? JSON.parse(tasksJson) : [],
        pendingActions: actionsJson ? JSON.parse(actionsJson) : [],
      });
    } catch {
      // ignore storage errors
    }
  },

  persistToStorage: async () => {
    const { cachedTasks, pendingActions } = get();
    try {
      await Promise.all([
        AsyncStorage.setItem("cached_tasks", JSON.stringify(cachedTasks)),
        AsyncStorage.setItem("pending_actions", JSON.stringify(pendingActions)),
      ]);
    } catch {
      // ignore storage errors
    }
  },
}));
