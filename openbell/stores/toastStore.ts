import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  action?: { label: string; onPress: () => void };
}

interface ToastState {
  currentToast: ToastData | null;
  queue: ToastData[];

  show: (message: string, type?: ToastType, duration?: number, action?: ToastData["action"]) => void;
  dismiss: () => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
  undo: (message: string, onUndo: () => void, duration?: number) => void;
}

let idCounter = 0;

export const useToastStore = create<ToastState>()((set, get) => ({
  currentToast: null,
  queue: [],

  show: (message, type = 'info', duration = 3000, action?) => {
    const toast: ToastData = {
      id: String(++idCounter),
      message,
      type,
      duration,
      action,
    };

    const { currentToast } = get();
    if (currentToast) {
      set((state) => ({ queue: [...state.queue, toast] }));
    } else {
      set({ currentToast: toast });
    }
  },

  dismiss: () => {
    const { queue } = get();
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      set({ currentToast: next, queue: rest });
    } else {
      set({ currentToast: null });
    }
  },

  success: (message) => get().show(message, 'success'),
  error: (message) => get().show(message, 'error'),
  warning: (message) => get().show(message, 'warning'),
  info: (message) => get().show(message, 'info'),
  undo: (message, onUndo, duration = 5000) =>
    get().show(message, 'warning', duration, { label: 'Undo', onPress: onUndo }),
}));
