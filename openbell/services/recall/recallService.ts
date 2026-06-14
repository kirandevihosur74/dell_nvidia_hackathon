// Recall.ai Meeting Bot — API client
// Uses streamIOApiClient (Kinde JWT auth, api.streamio.ai base URL)

import { streamIOApiClient } from "@/services/streamio/apiClient";
import type {
  MeetingPlatform,
  DeployBotParams,
  DeployBotResponse,
  ActiveBotResponse,
  BotStatusResponse,
  ValidateUrlResponse,
  LeaveBotResponse,
} from "@/types/recall";

// ─── Platform Detection (client-side) ───────────────────────────────

const PLATFORM_PATTERNS: Array<{ platform: MeetingPlatform; patterns: RegExp[] }> = [
  { platform: "zoom", patterns: [/zoom\.us/i, /\.zoom\.us/i] },
  { platform: "google_meet", patterns: [/meet\.google\.com/i, /g\.co\/meet/i] },
  { platform: "teams", patterns: [/teams\.microsoft\.com/i, /teams\.live\.com/i] },
  { platform: "webex", patterns: [/webex\.com/i] },
  { platform: "slack", patterns: [/slack\.com\/huddle/i, /app\.slack\.com\/huddle/i] },
];

export function detectPlatform(url: string): MeetingPlatform {
  for (const { platform, patterns } of PLATFORM_PATTERNS) {
    if (patterns.some((p) => p.test(url))) return platform;
  }
  return "unknown";
}

export function isValidMeetingUrl(url: string): boolean {
  try {
    new URL(url);
    return detectPlatform(url) !== "unknown";
  } catch {
    return false;
  }
}

export function getPlatformDisplayName(platform: MeetingPlatform): string {
  const names: Record<MeetingPlatform, string> = {
    zoom: "Zoom",
    google_meet: "Google Meet",
    teams: "Microsoft Teams",
    webex: "Webex",
    slack: "Slack Huddle",
    unknown: "Unknown",
  };
  return names[platform];
}

// ─── API Calls ──────────────────────────────────────────────────────

export async function deployMeetingBot(params: DeployBotParams): Promise<DeployBotResponse> {
  const body = {
    meetingUrl: params.meetingUrl,
    appSource: "clawmobile",
    routingMode: params.routingMode,
    pipeline: params.pipeline,
    budget: params.budget,
  };
  console.log("[RecallService] Deploy request:", JSON.stringify({ url: "/api/v1/recall/bot", routingMode: params.routingMode, hasPipeline: !!params.pipeline }));
  return streamIOApiClient.post<DeployBotResponse>("/api/v1/recall/bot", body);
}

export async function removeMeetingBot(botId: string): Promise<LeaveBotResponse> {
  return streamIOApiClient.post<LeaveBotResponse>(`/api/v1/recall/bot/${botId}/leave`);
}

export async function getActiveMeetingBot(): Promise<ActiveBotResponse> {
  return streamIOApiClient.get<ActiveBotResponse>("/api/v1/recall/bot/active");
}

export async function getBotStatus(botId: string): Promise<BotStatusResponse> {
  return streamIOApiClient.get<BotStatusResponse>(`/api/v1/recall/bot/${botId}`);
}

/** Force-kill all active Recall bot instances by polling active and removing until none remain. */
export async function killAllBots(): Promise<{ killed: number }> {
  let killed = 0;
  const maxAttempts = 5;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const active = await getActiveMeetingBot();
      if (!active.active || !active.botId) break;
      await removeMeetingBot(active.botId);
      killed++;
    } catch {
      break;
    }
  }
  return { killed };
}

export async function validateMeetingUrl(meetingUrl: string): Promise<ValidateUrlResponse> {
  return streamIOApiClient.post<ValidateUrlResponse>("/api/v1/recall/validate-url", { meetingUrl });
}

export async function uploadEncryptedTranscript(
  botId: string,
  encryptedBlob: string,
  encryptionKeyId?: string,
): Promise<{ success: boolean }> {
  return streamIOApiClient.post(`/api/v1/recall/bot/${botId}/transcript`, {
    encryptedBlob,
    encryptionKeyId,
  });
}

export async function pollBotStatus(botId: string): Promise<{
  success: boolean;
  botId: string;
  status: string;
  platform: string;
  duration: number;
  transcriptLines: Array<{ speaker: string; text: string; timestamp: string }>;
  transcriptLineCount: number;
}> {
  return streamIOApiClient.get(`/api/v1/recall/bot/${botId}/poll`);
}

export async function downloadEncryptedTranscript(
  botId: string,
): Promise<{ success: boolean; encryptedBlob: string; encryptionKeyId: string | null; uploadedAt: string }> {
  return streamIOApiClient.get(`/api/v1/recall/bot/${botId}/transcript`);
}

// ─── Speaker Timeline ─────────────────────────────────────────────

export async function getSpeakerStats(botId: string): Promise<{
  success: boolean;
  stats: import("@/types/recall").SpeakingStats;
}> {
  return streamIOApiClient.get(`/api/v1/recall/bot/${botId}/speakers`);
}

export async function getSpeakerSummary(botId: string): Promise<{
  success: boolean;
  summary: import("@/types/recall").SpeakerTimelineSummary | null;
}> {
  return streamIOApiClient.get(`/api/v1/recall/bot/${botId}/speakers/summary`);
}

// ─── Bot Chat Messages ────────────────────────────────────────────

// ─── Participant Events ───────────────────────────────────────────

export async function getParticipantEvents(botId: string): Promise<{
  success: boolean;
  events: import("@/types/recall").ParticipantEvent[];
}> {
  return streamIOApiClient.get(`/api/v1/recall/bot/${botId}/events`);
}

// ─── Bot Audio Output ─────────────────────────────────────────────

export async function speakToMeeting(
  botId: string,
  text: string,
  provider: import("@/types/recall").TTSProvider,
  voiceId: string,
): Promise<import("@/types/recall").SpeakToMeetingResponse> {
  return streamIOApiClient.post(`/api/v1/recall/bot/${botId}/speak`, { text, provider, voiceId });
}

// ─── Bot Chat Messages ────────────────────────────────────────────

export async function sendChatMessage(
  botId: string,
  message: string,
  to?: string,
): Promise<import("@/types/recall").SendChatResponse> {
  return streamIOApiClient.post(`/api/v1/recall/bot/${botId}/chat`, { message, to });
}
