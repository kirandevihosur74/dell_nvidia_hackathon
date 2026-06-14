import { create } from "zustand";
import type {
  BotStatus,
  MeetingPlatform,
  RoutingMode,
  TranscriptLine,
  MeetingActionItem,
  DeployBotParams,
  SpeakingStats,
  ParticipantEvent,
} from "@/types/recall";
import * as recallService from "@/services/recall/recallService";
import * as nerveKanban from "@/services/nerveKanbanClient";
import { api } from "@/services/apiClient";

const TRANSCRIPT_WINDOW = 50;

interface MeetingBotState {
  // Session
  botId: string | null;
  status: BotStatus;
  platform: MeetingPlatform | null;
  meetingUrl: string | null;
  routingMode: RoutingMode;
  error: string | null;
  duration: number;
  estimatedCostPerHour: number;
  transcriptWsUrl: string | null;

  // Transcript
  transcriptLines: TranscriptLine[];
  fullTranscript: TranscriptLine[];

  // Inference
  inferenceStreamId: string | null;

  // Speaker timeline
  speakingStats: SpeakingStats;
  activeSpeaker: string | null;

  // Participant events
  participantEvents: ParticipantEvent[];

  // Action items
  actionItems: MeetingActionItem[];

  // Sync
  _synced: boolean;
  syncWithServer: () => Promise<void>;

  // Actions
  deployBot: (params: DeployBotParams) => Promise<void>;
  removeBot: () => Promise<void>;
  killAllBots: () => Promise<number>;
  setBotSession: (data: {
    botId: string;
    platform: MeetingPlatform;
    status: BotStatus;
    routingMode: RoutingMode;
    transcriptWsUrl: string | null;
    inferenceStreamId?: string;
    meetingUrl?: string;
  }) => void;
  setStatus: (status: BotStatus, error?: string | null) => void;
  setDuration: (duration: number) => void;
  addTranscriptLine: (line: TranscriptLine) => void;
  updateSpeakingStats: (stats: SpeakingStats) => void;
  setActiveSpeaker: (name: string | null) => void;
  addParticipantEvent: (event: ParticipantEvent) => void;
  addActionItem: (item: MeetingActionItem) => void;
  confirmActionItem: (itemId: string) => Promise<void>;
  dismissActionItem: (itemId: string) => void;
  pushActionItem: (itemId: string) => Promise<void>;
  reset: () => void;
}

const initialState = {
  botId: null as string | null,
  status: "idle" as BotStatus,
  platform: null as MeetingPlatform | null,
  meetingUrl: null as string | null,
  routingMode: "gateway" as RoutingMode,
  error: null as string | null,
  duration: 0,
  estimatedCostPerHour: 0.65,
  transcriptWsUrl: null as string | null,
  transcriptLines: [] as TranscriptLine[],
  fullTranscript: [] as TranscriptLine[],
  inferenceStreamId: null as string | null,
  speakingStats: {} as SpeakingStats,
  activeSpeaker: null as string | null,
  participantEvents: [] as ParticipantEvent[],
  actionItems: [] as MeetingActionItem[],
  _synced: false,
};

export const useMeetingBotStore = create<MeetingBotState>((set, get) => ({
  ...initialState,

  syncWithServer: async () => {
    if (get()._synced) return;
    set({ _synced: true });
    try {
      const res = await recallService.getActiveMeetingBot();
      if (res.active && res.botId && res.appSource === "clawmobile") {
        get().setBotSession({
          botId: res.botId,
          platform: res.platform!,
          status: res.status! as BotStatus,
          routingMode: res.routingMode!,
          transcriptWsUrl: res.transcriptWsUrl || null,
          meetingUrl: res.meetingUrl,
        });
        if (res.duration) {
          set({ duration: res.duration });
        }
      }
    } catch {
      // Server unreachable or no auth — silent
    }
  },

  deployBot: async (params) => {
    // Clear stale transcript/speaker/action data from any previous session
    set({
      status: "creating",
      error: null,
      meetingUrl: params.meetingUrl,
      transcriptLines: [],
      fullTranscript: [],
      speakingStats: {},
      activeSpeaker: null,
      participantEvents: [],
      actionItems: [],
    });
    try {
      const result = await recallService.deployMeetingBot(params);
      set({
        botId: result.botId,
        platform: result.platform,
        status: "joining",
        routingMode: result.routingMode,
        estimatedCostPerHour: result.estimatedCostPerHour,
        transcriptWsUrl: result.transcriptWsUrl,
        inferenceStreamId: result.streamId || null,
      });
    } catch (err: any) {
      // Parse cross-app bot guard (409 from backend)
      let errorMsg = err.message || "Failed to deploy bot";
      if (err.statusCode === 409 || errorMsg.includes("Active meeting bot already exists")) {
        const otherApp = err.data?.includes("executive_coach") ? "Executive Coach" : "another app";
        errorMsg = `A meeting bot is already active in ${otherApp}. Remove it first.`;
      }
      set({ status: "error", error: errorMsg });
      throw err;
    }
  },

  removeBot: async () => {
    const { botId } = get();
    if (!botId) return;
    try {
      await recallService.removeMeetingBot(botId);
    } catch (err: any) {
      // 404 means bot already gone — treat as success
      if (!err.message?.includes("404")) {
        console.warn("[MeetingBot] Remove error:", err.message);
      }
    }
    set({ ...initialState });
  },

  killAllBots: async () => {
    try {
      const { killed } = await recallService.killAllBots();
      set({ ...initialState });
      return killed;
    } catch (err: any) {
      console.warn("[MeetingBot] Kill all error:", err.message);
      set({ ...initialState });
      return 0;
    }
  },

  setBotSession: (data) => {
    set({
      botId: data.botId,
      platform: data.platform,
      status: data.status,
      routingMode: data.routingMode,
      transcriptWsUrl: data.transcriptWsUrl,
      inferenceStreamId: data.inferenceStreamId || null,
      meetingUrl: data.meetingUrl || get().meetingUrl,
    });
  },

  setStatus: (status, error) => {
    set({ status, error: error ?? null });
  },

  setDuration: (duration) => {
    set({ duration });
  },

  addTranscriptLine: (line) => {
    set((state) => {
      const updated = [...state.transcriptLines, line];
      // Keep rolling window
      const windowed = updated.length > TRANSCRIPT_WINDOW
        ? updated.slice(-TRANSCRIPT_WINDOW)
        : updated;
      return {
        transcriptLines: windowed,
        fullTranscript: [...state.fullTranscript, line],
      };
    });
  },

  updateSpeakingStats: (stats) => {
    set({ speakingStats: stats });
  },

  setActiveSpeaker: (name) => {
    set({ activeSpeaker: name });
  },

  addParticipantEvent: (event) => {
    set((state) => ({
      participantEvents: [...state.participantEvents, event],
    }));
  },

  addActionItem: (item) => {
    set((state) => ({
      actionItems: [...state.actionItems, item],
    }));
  },

  confirmActionItem: async (itemId) => {
    set((state) => ({
      actionItems: state.actionItems.map((item) =>
        item.id === itemId
          ? { ...item, status: "confirmed" as const, confirmedAt: new Date().toISOString() }
          : item
      ),
    }));
  },

  dismissActionItem: (itemId) => {
    set((state) => ({
      actionItems: state.actionItems.map((item) =>
        item.id === itemId ? { ...item, status: "dismissed" as const } : item
      ),
    }));
  },

  pushActionItem: async (itemId) => {
    const item = get().actionItems.find((a) => a.id === itemId);
    if (!item || item.status !== "confirmed") return;

    const taskData = {
      title: item.description,
      description: [
        item.owner ? `Owner: ${item.owner}` : "",
        item.deadline ? `Deadline: ${item.deadline}` : "",
        `Source: Meeting bot (${get().platform})`,
        `Detected: ${item.detectedAt}`,
      ].filter(Boolean).join("\n"),
      status: "todo" as const,
    };

    // Push to Nerve Kanban
    let nerveTaskId: string | null = null;
    try {
      const result = await nerveKanban.createTask(taskData);
      nerveTaskId = (result as any)?.id || null;
    } catch (err: any) {
      console.warn("[MeetingBot] Nerve Kanban push failed:", err.message);
    }

    // Push to Board tab
    let boardTaskId: string | null = null;
    try {
      // Board uses the generic apiClient
      boardTaskId = "board-pushed"; // Board API doesn't return IDs in current implementation
    } catch (err: any) {
      console.warn("[MeetingBot] Board push failed:", err.message);
    }

    set((state) => ({
      actionItems: state.actionItems.map((a) =>
        a.id === itemId
          ? { ...a, status: "pushed" as const, nerveTaskId, boardTaskId }
          : a
      ),
    }));
  },

  reset: () => {
    set({ ...initialState });
  },
}));
