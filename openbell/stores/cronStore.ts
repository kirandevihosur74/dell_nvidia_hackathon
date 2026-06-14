import { create } from "zustand";
import * as nerveCron from "@/services/nerveCronClient";
import type { CronJob } from "@/types/gateway";

interface CronState {
  jobs: CronJob[];
  loading: boolean;
  error: string | null;

  listJobs: () => Promise<void>;
  createJob: (job: { schedule: string; command: string; agentId: string }) => Promise<void>;
  toggleJob: (id: string) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  runJob: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useCronStore = create<CronState>((set, get) => ({
  jobs: [],
  loading: false,
  error: null,

  listJobs: async () => {
    set({ loading: true, error: null });
    try {
      const jobs = await nerveCron.listCrons();
      set({ jobs, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list cron jobs";
      set({ loading: false, error: message });
    }
  },

  createJob: async (job) => {
    set({ error: null });
    try {
      const created = await nerveCron.createCron(job);
      set((s) => ({ jobs: [...s.jobs, created] }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create cron job";
      set({ error: message });
      throw err;
    }
  },

  toggleJob: async (id) => {
    const { jobs } = get();
    const job = jobs.find((j) => j.id === id);
    if (!job) return;

    // Optimistic
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, enabled: !j.enabled } : j)),
    }));

    try {
      await nerveCron.toggleCron(id, !job.enabled);
    } catch (err) {
      // Revert
      set((s) => ({
        jobs: s.jobs.map((j) => (j.id === id ? { ...j, enabled: job.enabled } : j)),
        error: err instanceof Error ? err.message : "Failed to toggle cron job",
      }));
    }
  },

  deleteJob: async (id) => {
    set({ error: null });
    try {
      await nerveCron.deleteCron(id);
      set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete cron job" });
    }
  },

  runJob: async (id) => {
    set({ error: null });
    try {
      await nerveCron.runCron(id);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to run cron job" });
    }
  },

  clearError: () => set({ error: null }),
}));
