// Converts StreamIO events into the Activity feed format used by ClawMobile
import { useMemo } from 'react';
import { useStreamIOStreamStore } from '@/stores/streamio/streamStore';
import { useStreamIOInferenceStore } from '@/stores/streamio/inferenceStore';
import { useStreamIOAnalyticsStore } from '@/stores/streamio/analyticsStore';

export type StreamActivityType =
  | 'stream_started'
  | 'stream_ended'
  | 'stream_milestone'
  | 'inference_event'
  | 'terminal_command';

export interface StreamActivity {
  id: string;
  type: StreamActivityType;
  source: 'stream';
  title: string;
  detail: string;
  timestamp: string;
  metadata?: {
    streamId?: string;
    duration?: number;
    segmentCount?: number;
    agentName?: string;
    command?: string;
  };
}

export function useStreamActivity(): StreamActivity[] {
  const status = useStreamIOStreamStore((s) => s.status);
  const activeStreamId = useStreamIOStreamStore((s) => s.activeStreamId);
  const segmentCount = useStreamIOStreamStore((s) => s.segmentCount);
  const startedAt = useStreamIOStreamStore((s) => s.startedAt);
  const duration = useStreamIOStreamStore((s) => s.duration);
  const chatMessages = useStreamIOInferenceStore((s) => s.chatMessages);
  const sessions = useStreamIOAnalyticsStore((s) => s.sessions);

  return useMemo(() => {
    const activities: StreamActivity[] = [];

    // Active stream event
    if (status === 'streaming' && activeStreamId && startedAt) {
      activities.push({
        id: `stream-live-${activeStreamId}`,
        type: 'stream_started',
        source: 'stream',
        title: 'Stream Live',
        detail: `Streaming for ${formatDurationShort(duration)} · ${segmentCount} segments`,
        timestamp: startedAt,
        metadata: { streamId: activeStreamId, duration, segmentCount },
      });
    }

    // Segment milestones
    if (status === 'streaming' && segmentCount > 0 && segmentCount % 50 === 0) {
      activities.push({
        id: `milestone-${activeStreamId}-${segmentCount}`,
        type: 'stream_milestone',
        source: 'stream',
        title: 'Segment Milestone',
        detail: `Reached ${segmentCount} segments`,
        timestamp: new Date().toISOString(),
        metadata: { streamId: activeStreamId || undefined, segmentCount },
      });
    }

    // Recent inference chat events (last 5)
    const recentChats = chatMessages.slice(-5);
    for (const msg of recentChats) {
      if (msg.isComplete) {
        activities.push({
          id: `inference-${msg.id}`,
          type: 'inference_event',
          source: 'stream',
          title: `${msg.agentName} Analysis`,
          detail: msg.content.length > 100 ? msg.content.slice(0, 100) + '...' : msg.content,
          timestamp: new Date(msg.timestamp).toISOString(),
          metadata: { agentName: msg.agentName },
        });
      }
    }

    // Past sessions (last 10)
    const recentSessions = sessions.slice(-10);
    for (const session of recentSessions) {
      if (session.endedAt) {
        activities.push({
          id: `session-${session.id}`,
          type: 'stream_ended',
          source: 'stream',
          title: 'Stream Ended',
          detail: `${formatDurationShort(Math.floor((session.durationMs || 0) / 1000))} · ${session.segmentCount || 0} segments`,
          timestamp: session.endedAt,
          metadata: {
            streamId: session.id,
            duration: Math.floor((session.durationMs || 0) / 1000),
            segmentCount: session.segmentCount,
          },
        });
      }
    }

    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return activities;
  }, [status, activeStreamId, segmentCount, startedAt, duration, chatMessages, sessions]);
}

function formatDurationShort(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
