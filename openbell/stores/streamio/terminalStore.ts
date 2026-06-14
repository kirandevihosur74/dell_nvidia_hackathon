import { create } from 'zustand';

export interface TerminalEntry {
  id: string;
  command: string;
  output: string;
  exitCode: number;
  timestamp: string;
}

interface TerminalState {
  // Connection
  isConnected: boolean;
  mode: 'remote' | 'command';
  sessionId: string | null;

  // Output buffer (for remote shell)
  outputBuffer: string;

  // Command history (for command interface)
  entries: TerminalEntry[];
  commandHistory: string[];
  historyIndex: number;

  // Input
  inputText: string;

  // Actions
  setConnected: (connected: boolean) => void;
  setMode: (mode: 'remote' | 'command') => void;
  setSessionId: (id: string | null) => void;
  appendOutput: (data: string) => void;
  clearOutput: () => void;
  addEntry: (entry: TerminalEntry) => void;
  setInputText: (text: string) => void;
  navigateHistory: (direction: 'up' | 'down') => void;
  clearEntries: () => void;
}

let entryCounter = 0;

export function createEntryId(): string {
  return `entry_${Date.now()}_${++entryCounter}`;
}

export const useStreamIOTerminalStore = create<TerminalState>()((set, get) => ({
  isConnected: false,
  mode: 'command',
  sessionId: null,
  outputBuffer: '',
  entries: [],
  commandHistory: [],
  historyIndex: -1,
  inputText: '',

  setConnected: (isConnected) => set({ isConnected }),
  setMode: (mode) => set({ mode }),
  setSessionId: (sessionId) => set({ sessionId }),

  appendOutput: (data) =>
    set((state) => ({ outputBuffer: state.outputBuffer + data })),

  clearOutput: () => set({ outputBuffer: '' }),

  addEntry: (entry) =>
    set((state) => ({
      entries: [...state.entries, entry],
      commandHistory: [...state.commandHistory, entry.command].slice(-200),
      historyIndex: -1,
    })),

  setInputText: (inputText) => set({ inputText }),

  navigateHistory: (direction) => {
    const { commandHistory, historyIndex } = get();
    if (commandHistory.length === 0) return;

    let newIndex: number;
    if (direction === 'up') {
      newIndex = historyIndex === -1
        ? commandHistory.length - 1
        : Math.max(0, historyIndex - 1);
    } else {
      newIndex = historyIndex === -1
        ? -1
        : historyIndex >= commandHistory.length - 1
          ? -1
          : historyIndex + 1;
    }

    set({
      historyIndex: newIndex,
      inputText: newIndex === -1 ? '' : commandHistory[newIndex],
    });
  },

  clearEntries: () => set({ entries: [], outputBuffer: '' }),
}));
