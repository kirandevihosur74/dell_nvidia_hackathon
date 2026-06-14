// Recall.ai Meeting Bot — type definitions

export type MeetingPlatform = 'zoom' | 'google_meet' | 'teams' | 'webex' | 'slack' | 'unknown';
export type BotStatus = 'idle' | 'creating' | 'joining' | 'in_waiting_room' | 'recording' | 'done' | 'error';
export type RoutingMode = 'gateway' | 'inference' | 'both';

export interface TranscriptLine {
  speaker: string;
  text: string;
  timestamp: string; // ISO 8601
}

export interface MeetingActionItem {
  id: string;
  description: string;
  owner: string | null;
  deadline: string | null;
  status: 'detected' | 'confirmed' | 'pushed' | 'dismissed';
  nerveTaskId: string | null;
  boardTaskId: string | null;
  sourceAgentId: string;
  detectedAt: string;
  confirmedAt: string | null;
}

// ─── API Request/Response Types ─────────────────────────────────────

export interface DeployBotParams {
  meetingUrl: string;
  routingMode: RoutingMode;
  pipeline?: {
    stages: Array<{
      stageIndex: number;
      agents: string[];
      passContextToNext: boolean;
    }>;
  };
  budget?: {
    maxTokens: number;
    maxCost: number;
    onExceeded: 'degrade' | 'pause' | 'stop';
  };
}

export interface DeployBotResponse {
  success: boolean;
  botId: string;
  streamId: string;
  platform: MeetingPlatform;
  status: BotStatus;
  routingMode: RoutingMode;
  estimatedCostPerHour: number;
  transcriptWsUrl: string | null;
  inferenceStreamId?: string;
}

export interface ActiveBotResponse {
  active: boolean;
  botId?: string;
  streamId?: string;
  platform?: MeetingPlatform;
  status?: BotStatus;
  meetingUrl?: string;
  duration?: number;
  appSource?: string;
  routingMode?: RoutingMode;
  transcriptWsUrl?: string | null;
  transcriptLines?: number;
}

export interface BotStatusResponse {
  success: boolean;
  botId: string;
  streamId: string;
  platform: MeetingPlatform;
  status: BotStatus;
  meetingUrl: string;
  duration: number;
  statusHistory: Array<{ status: string; timestamp: string; subCode?: string }>;
  transcriptLines: number;
  appSource: string;
  routingMode: RoutingMode;
}

export interface ValidateUrlResponse {
  valid: boolean;
  platform: MeetingPlatform;
}

export interface LeaveBotResponse {
  success: boolean;
  message: string;
  transcriptLines?: number;
  duration?: number;
}

// ─── Speaker Timeline Types ──────────────────────────────────────────

export interface SpeakingStatEntry {
  totalSeconds: number;
  percentage: number;
  isActive: boolean;
  segments: Array<{ start: number; end: number | null }>;
}

export interface SpeakingStats {
  [participantName: string]: SpeakingStatEntry;
}

export interface SpeakerTimelineSummary {
  totalDuration: number;
  stats: SpeakingStats;
  dominantSpeaker: string;
  silencePercentage: number;
}

// ─── Participant Event Types ─────────────────────────────────────────

export type ParticipantEventType =
  | 'join' | 'leave'
  | 'speech_on' | 'speech_off'
  | 'webcam_on' | 'webcam_off'
  | 'screenshare_on' | 'screenshare_off';

export interface ParticipantEvent {
  type: ParticipantEventType;
  participant: {
    id: number;
    name: string | null;
    isHost: boolean;
  };
  timestamp: { absolute: string; relative: number };
}

// ─── Bot Audio Output Types ─────────────────────────────────────────

export type TTSProvider = 'elevenlabs' | 'openai';

export interface SpeakToMeetingRequest {
  text: string;
  provider: TTSProvider;
  voiceId: string;
}

export interface SpeakToMeetingResponse {
  success: boolean;
  durationMs: number;
  provider: TTSProvider;
  charCount: number;
}

// ─── Bot Chat Types ─────────────────────────────────────────────────

export interface SendChatRequest {
  message: string;
  to?: string;
}

export interface SendChatResponse {
  success: boolean;
  platform: MeetingPlatform;
  charLimit: number;
  truncated: boolean;
}

// ─── WebSocket Event Types (from StreamIO transcript stream) ────────

export interface TranscriptWsEvent {
  type: 'bot_status' | 'bot_error' | 'transcript' | 'context_update' | 'speaker_active' | 'speaking_stats' | 'participant_event';
}

export interface BotStatusEvent extends TranscriptWsEvent {
  type: 'bot_status';
  botId: string;
  status: BotStatus;
  platform: MeetingPlatform;
  meetingUrl?: string;
  timestamp: number;
  duration?: number;
}

export interface BotErrorEvent extends TranscriptWsEvent {
  type: 'bot_error';
  botId: string;
  error: string;
  subCode?: string;
}

export interface TranscriptEvent extends TranscriptWsEvent {
  type: 'transcript';
  speaker: string;
  text: string;
  timestamp: string;
}

export interface ContextUpdateEvent extends TranscriptWsEvent {
  type: 'context_update';
  transcriptLines: number;
  duration: number;
}

export interface SpeakerActiveEvent extends TranscriptWsEvent {
  type: 'speaker_active';
  participantName: string;
  isActive: boolean;
  timestamp: string;
}

export interface SpeakingStatsEvent extends TranscriptWsEvent {
  type: 'speaking_stats';
  stats: SpeakingStats;
  duration: number;
}

export interface ParticipantEventWs extends TranscriptWsEvent {
  type: 'participant_event';
  participant: { id: number; name: string | null; isHost: boolean };
  timestamp: { absolute: string; relative: number };
  // The sub-type is in the outer type field from the service, but we reuse ParticipantEventType
  eventType?: ParticipantEventType;
}

// ─── Platform Metadata ──────────────────────────────────────────────

export interface PlatformInfo {
  name: string;
  color: string;
  icon: string;
}

export const PLATFORM_INFO: Record<MeetingPlatform, PlatformInfo> = {
  zoom: { name: 'Zoom', color: '#2D8CFF', icon: 'video' },
  google_meet: { name: 'Google Meet', color: '#00897B', icon: 'video' },
  teams: { name: 'Teams', color: '#6264A7', icon: 'video' },
  webex: { name: 'Webex', color: '#049FD9', icon: 'video' },
  slack: { name: 'Slack', color: '#611F69', icon: 'headphones' },
  unknown: { name: 'Unknown', color: '#888888', icon: 'help-circle' },
};
