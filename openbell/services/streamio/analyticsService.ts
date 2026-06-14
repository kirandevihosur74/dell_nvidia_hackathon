// Analytics service — tracks stream performance, AI usage, and app metrics
// Aggregates data for the Analytics tab

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStreamIOAnalyticsStore, StreamSession, AnalyticsSnapshot } from '@/stores/streamio/analyticsStore';

const SESSIONS_KEY = 'streamio:stream_sessions';
const USAGE_KEY = 'streamio:usage_stats';

// --- Stream session tracking ---

export async function recordStreamSession(session: Omit<StreamSession, 'id'>): Promise<void> {
  const fullSession: StreamSession = {
    ...session,
    id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  };

  useStreamIOAnalyticsStore.getState().addSession(fullSession);
  await persistSessions();
}

export async function loadSessions(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    if (raw) {
      const sessions: StreamSession[] = JSON.parse(raw);
      useStreamIOAnalyticsStore.getState().setSessions(sessions);
    }
  } catch {
    // Silently reset
  }
}

async function persistSessions(): Promise<void> {
  const sessions = useStreamIOAnalyticsStore.getState().sessions;
  // Keep last 100 sessions
  const trimmed = sessions.slice(-100);
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(trimmed));
}

// --- Usage tracking ---

export async function incrementUsage(feature: string): Promise<void> {
  useStreamIOAnalyticsStore.getState().incrementUsage(feature);
  await persistUsage();
}

export async function loadUsageStats(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(USAGE_KEY);
    if (raw) {
      useStreamIOAnalyticsStore.getState().setUsageStats(JSON.parse(raw));
    }
  } catch {
    // Silently reset
  }
}

async function persistUsage(): Promise<void> {
  const usage = useStreamIOAnalyticsStore.getState().usageStats;
  await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(usage));
}

// --- Analytics computations ---

export function computeSnapshot(): AnalyticsSnapshot {
  const { sessions, usageStats } = useStreamIOAnalyticsStore.getState();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const weeklySessions = sessions.filter((s) => new Date(s.startedAt) >= weekAgo);
  const monthlySessions = sessions.filter((s) => new Date(s.startedAt) >= monthAgo);

  const totalDurationMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);
  const weeklyDurationMs = weeklySessions.reduce((sum, s) => sum + s.durationMs, 0);

  const totalViewers = sessions.reduce((sum, s) => sum + s.peakViewers, 0);
  const avgViewers = sessions.length > 0 ? Math.round(totalViewers / sessions.length) : 0;

  const peakViewers = sessions.reduce((max, s) => Math.max(max, s.peakViewers), 0);

  // Compute daily streaming hours for the last 7 days
  const dailyHours: { date: string; hours: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const daySessions = sessions.filter(
      (s) => s.startedAt.startsWith(dateStr),
    );
    const hours = daySessions.reduce((sum, s) => sum + s.durationMs / 3600000, 0);
    dailyHours.push({ date: dateStr, hours: Math.round(hours * 10) / 10 });
  }

  const snapshot: AnalyticsSnapshot = {
    totalSessions: sessions.length,
    weeklySessions: weeklySessions.length,
    monthlySessions: monthlySessions.length,
    totalStreamTimeMs: totalDurationMs,
    weeklyStreamTimeMs: weeklyDurationMs,
    avgViewersPerSession: avgViewers,
    peakViewers,
    totalSegments: sessions.reduce((sum, s) => sum + s.segmentCount, 0),
    aiChatMessages: usageStats.aiChatMessages || 0,
    propertyAnalyses: usageStats.propertyAnalyses || 0,
    tradingAnalyses: usageStats.tradingAnalyses || 0,
    ttsUtterances: usageStats.ttsUtterances || 0,
    sttTranscriptions: usageStats.sttTranscriptions || 0,
    dailyStreamingHours: dailyHours,
  };

  useStreamIOAnalyticsStore.getState().setSnapshot(snapshot);
  return snapshot;
}

export function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
