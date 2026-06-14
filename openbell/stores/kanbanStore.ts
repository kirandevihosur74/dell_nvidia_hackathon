import { create } from "zustand";
import * as nerveKanban from "@/services/nerveKanbanClient";
import { useToastStore } from "@/stores/toastStore";
import type { KanbanTask, KanbanProposal, KanbanStatus } from "@/types/gateway";

const UNDO_DELAY = 5000;

/** Pending timers for deferred actions */
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

function cancelPending(key: string) {
  const timer = pendingTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    pendingTimers.delete(key);
  }
}

interface KanbanState {
  tasks: KanbanTask[];
  proposals: KanbanProposal[];
  loading: boolean;
  error: string | null;

  loadBoard: () => Promise<void>;
  createTask: (task: { title: string; description?: string; status: KanbanStatus; priority?: string }) => Promise<void>;
  updateTask: (id: string, updates: Partial<Pick<KanbanTask, "title" | "description" | "status" | "priority">>) => Promise<void>;
  deleteTask: (id: string) => void;
  moveTask: (id: string, status: KanbanStatus) => void;
  loadProposals: () => Promise<void>;
  approveProposal: (id: string) => Promise<void>;
  rejectProposal: (id: string, reason?: string) => Promise<void>;
  clearError: () => void;
}

export const useKanbanStore = create<KanbanState>((set, get) => ({
  tasks: [],
  proposals: [],
  loading: false,
  error: null,

  loadBoard: async () => {
    set({ loading: true, error: null });
    try {
      const tasks = await nerveKanban.listTasks();
      set({ tasks, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Failed to load kanban board" });
    }
  },

  createTask: async (task) => {
    set({ error: null });
    try {
      const created = await nerveKanban.createTask(task);
      set((s) => ({ tasks: [...s.tasks, created] }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to create task" });
      throw err;
    }
  },

  updateTask: async (id, updates) => {
    set({ error: null });
    try {
      const current = get().tasks.find((t) => t.id === id);
      const version = current?.version || 1;
      const updated = await nerveKanban.updateTask(id, version, updates);
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));
    } catch (err) {
      if (err instanceof Error && err.message.includes("version_conflict")) {
        get().loadBoard();
      }
      set({ error: err instanceof Error ? err.message : "Failed to update task" });
    }
  },

  deleteTask: (id) => {
    const prevTasks = get().tasks;
    const deleted = prevTasks.find((t) => t.id === id);
    if (!deleted) return;

    // Optimistic remove
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));

    // Defer the actual API call
    const timerKey = `delete-${id}`;
    cancelPending(timerKey);

    const timer = setTimeout(async () => {
      pendingTimers.delete(timerKey);
      try {
        await nerveKanban.deleteTask(id);
      } catch (err) {
        // Restore on failure
        set((s) => ({ tasks: [...s.tasks, deleted], error: err instanceof Error ? err.message : "Failed to delete task" }));
      }
    }, UNDO_DELAY);

    pendingTimers.set(timerKey, timer);

    // Show undo toast
    useToastStore.getState().undo(`"${deleted.title}" deleted`, () => {
      cancelPending(timerKey);
      // Restore the task
      set((s) => ({ tasks: [...s.tasks, deleted] }));
    });
  },

  moveTask: (id, status) => {
    const prevTasks = get().tasks;
    const current = prevTasks.find((t) => t.id === id);
    if (!current) return;

    const prevStatus = current.status;
    const version = current.version || 1;

    // Optimistic update
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status, updatedAt: Date.now() } : t)),
    }));

    // Defer the actual API call
    const timerKey = `move-${id}`;
    cancelPending(timerKey);

    const timer = setTimeout(async () => {
      pendingTimers.delete(timerKey);
      try {
        await nerveKanban.reorderTask(id, version, status, 0);
        // Refetch to get updated version
        get().loadBoard();
      } catch (err) {
        // Revert on failure
        set({ tasks: prevTasks, error: err instanceof Error ? err.message : "Failed to move task" });
      }
    }, UNDO_DELAY);

    pendingTimers.set(timerKey, timer);

    // Show undo toast
    const statusLabels: Record<string, string> = {
      backlog: "Backlog", todo: "To Do", "in-progress": "In Progress", review: "Review", done: "Done",
    };
    useToastStore.getState().undo(
      `Moved to ${statusLabels[status] || status}`,
      () => {
        cancelPending(timerKey);
        // Revert to previous state
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: prevStatus } : t)),
        }));
      }
    );
  },

  loadProposals: async () => {
    try {
      const proposals = await nerveKanban.listProposals();
      set({ proposals });
    } catch {
      // Proposals might not be available — silent fail
    }
  },

  approveProposal: async (id) => {
    set({ error: null });
    try {
      const { task } = await nerveKanban.approveProposal(id);
      set((s) => ({
        proposals: s.proposals.filter((p) => p.id !== id),
        tasks: s.tasks.some((t) => t.id === task.id)
          ? s.tasks.map((t) => (t.id === task.id ? task : t))
          : [...s.tasks, task],
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to approve proposal" });
    }
  },

  rejectProposal: async (id, reason) => {
    set({ error: null });
    try {
      await nerveKanban.rejectProposal(id, reason);
      set((s) => ({ proposals: s.proposals.filter((p) => p.id !== id) }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to reject proposal" });
    }
  },

  clearError: () => set({ error: null }),
}));
