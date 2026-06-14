import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_SYMBOLS, SEED_OPEN, SEED_CLOSE, REPORTS, groupMetricKeys, type ReportId } from "@/constants/reportModel";

/**
 * Shared Scheduled-Report configuration. The onboarding flow writes the user's
 * picks here; the Report tab reads this to pre-fill its builder. Persisted so the
 * setup survives restarts.
 */
export interface ReportConfigState {
  configured: boolean; // true once onboarding has tailored the report
  symbols: string[];
  selected: Record<ReportId, string[]>; // metric keys per report
  freq: Record<ReportId, string>;
  enabled: Record<ReportId, boolean>;

  toggleSymbol: (sym: string) => void;
  addSymbol: (sym: string) => void;
  removeSymbol: (sym: string) => void;
  setSelected: (id: ReportId, keys: string[]) => void;
  /** Add/remove a whole metric group for both reports (used by onboarding "what to analyze"). */
  toggleGroupBoth: (groupId: string) => void;
  isGroupOnBoth: (groupId: string) => boolean;
  setFreq: (id: ReportId, freq: string) => void;
  setEnabled: (id: ReportId, on: boolean) => void;
  markConfigured: () => void;
  reset: () => void;
}

const initial = {
  configured: false,
  symbols: [...DEFAULT_SYMBOLS],
  selected: { open: [...SEED_OPEN], close: [...SEED_CLOSE] } as Record<ReportId, string[]>,
  freq: { open: REPORTS.open.freq, close: REPORTS.close.freq } as Record<ReportId, string>,
  enabled: { open: true, close: true } as Record<ReportId, boolean>,
};

export const useReportConfigStore = create<ReportConfigState>()(
  persist(
    (set, get) => ({
      ...initial,

      toggleSymbol: (sym) =>
        set((s) => ({
          symbols: s.symbols.includes(sym) ? s.symbols.filter((x) => x !== sym) : [...s.symbols, sym],
        })),
      addSymbol: (sym) =>
        set((s) => (s.symbols.includes(sym) ? s : { symbols: [...s.symbols, sym] })),
      removeSymbol: (sym) => set((s) => ({ symbols: s.symbols.filter((x) => x !== sym) })),

      setSelected: (id, keys) => set((s) => ({ selected: { ...s.selected, [id]: keys } })),

      toggleGroupBoth: (groupId) =>
        set((s) => {
          const gk = groupMetricKeys(groupId);
          const isOn = gk.every((k) => s.selected.open.includes(k));
          const apply = (arr: string[]) =>
            isOn ? arr.filter((k) => !gk.includes(k)) : Array.from(new Set([...arr, ...gk]));
          return { selected: { open: apply(s.selected.open), close: apply(s.selected.close) } };
        }),
      isGroupOnBoth: (groupId) => {
        const gk = groupMetricKeys(groupId);
        const sel = get().selected.open;
        return gk.length > 0 && gk.every((k) => sel.includes(k));
      },

      setFreq: (id, freq) => set((s) => ({ freq: { ...s.freq, [id]: freq } })),
      setEnabled: (id, on) => set((s) => ({ enabled: { ...s.enabled, [id]: on } })),

      markConfigured: () => set({ configured: true }),
      reset: () => set({ ...initial, selected: { open: [...SEED_OPEN], close: [...SEED_CLOSE] } }),
    }),
    {
      name: "report-config-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
