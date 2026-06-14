import { create } from 'zustand';

export interface StreamSession {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  segmentCount: number;
  peakViewers: number;
  captureSource: 'screen' | 'camera' | 'composite';
  transcodingMode: 'onDevice' | 'serverSide';
}

export interface AnalyticsSnapshot {
  totalSessions: number;
  weeklySessions: number;
  monthlySessions: number;
  totalStreamTimeMs: number;
  weeklyStreamTimeMs: number;
  avgViewersPerSession: number;
  peakViewers: number;
  totalSegments: number;
  aiChatMessages: number;
  propertyAnalyses: number;
  tradingAnalyses: number;
  ttsUtterances: number;
  sttTranscriptions: number;
  dailyStreamingHours: { date: string; hours: number }[];
}

interface AnalyticsState {
  sessions: StreamSession[];
  usageStats: Record<string, number>;
  snapshot: AnalyticsSnapshot | null;

  addSession: (session: StreamSession) => void;
  setSessions: (sessions: StreamSession[]) => void;
  incrementUsage: (feature: string) => void;
  setUsageStats: (stats: Record<string, number>) => void;
  setSnapshot: (snapshot: AnalyticsSnapshot) => void;
}

export const useStreamIOAnalyticsStore = create<AnalyticsState>()((set) => ({
  sessions: [],
  usageStats: {},
  snapshot: null,

  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session].slice(-100),
    })),

  setSessions: (sessions) => set({ sessions }),

  incrementUsage: (feature) =>
    set((state) => ({
      usageStats: {
        ...state.usageStats,
        [feature]: (state.usageStats[feature] || 0) + 1,
      },
    })),

  setUsageStats: (usageStats) => set({ usageStats }),
  setSnapshot: (snapshot) => set({ snapshot }),
}));
