// useMeetingBot — manages the StreamIO WebSocket connection for real-time
// transcript and bot status events from api.streamio.ai.
//
// This is completely separate from the Gateway WebSocket (local OpenClaw).

import { useEffect, useRef, useCallback } from "react";
import { useMeetingBotStore } from "@/stores/meetingBotStore";
import { useGatewayStore } from "@/stores/gatewayStore";
import { gatewayClient, makeIdempotencyKey } from "@/services/gateway";
import { getProvider } from "@/services/gateway/providers/registry";
import * as recallService from "@/services/recall/recallService";
import * as InferenceService from "@/services/streamio/inferenceService";
import { e2eService } from "@/services/encryption";
import type {
  BotStatusEvent,
  BotErrorEvent,
  TranscriptEvent,
  ContextUpdateEvent,
  SpeakerActiveEvent,
  SpeakingStatsEvent,
  ParticipantEventWs,
  BotStatus,
} from "@/types/recall";

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];
const MAX_RECONNECT = 30;

export function useMeetingBot() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intentionalCloseRef = useRef(false);

  const {
    botId,
    status,
    platform,
    meetingUrl,
    routingMode,
    error,
    duration,
    transcriptLines,
    fullTranscript,
    actionItems,
    transcriptWsUrl,
    inferenceStreamId,
    estimatedCostPerHour,
    deployBot,
    removeBot,
    setBotSession,
    setStatus,
    setDuration,
    addTranscriptLine,
    updateSpeakingStats,
    setActiveSpeaker,
    addParticipantEvent,
    addActionItem,
    confirmActionItem,
    dismissActionItem,
    pushActionItem,
    reset,
    speakingStats,
    activeSpeaker,
    participantEvents,
  } = useMeetingBotStore();

  // ─── WebSocket Connection ───────────────────────────────────────

  const connectWs = useCallback((url: string) => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    intentionalCloseRef.current = false;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWsMessage(data);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (!intentionalCloseRef.current && reconnectAttemptRef.current < MAX_RECONNECT) {
        const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)];
        reconnectTimerRef.current = setTimeout(() => {
          reconnectAttemptRef.current++;
          connectWs(url);
        }, delay);
      }
    };

    ws.onerror = () => {
      // onclose will fire after this
    };
  }, []);

  const disconnectWs = useCallback(() => {
    intentionalCloseRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // ─── Message Handler ────────────────────────────────────────────

  const handleWsMessage = useCallback((data: any) => {
    switch (data.type) {
      case "bot_status": {
        const evt = data as BotStatusEvent;
        setStatus(evt.status as BotStatus);
        if (evt.duration !== undefined) {
          setDuration(evt.duration);
        }
        // Terminal states — stop duration timer
        if (evt.status === "done" || evt.status === "error") {
          stopDurationTimer();
        }
        // Recording started — start duration timer
        if (evt.status === "recording") {
          startDurationTimer();
        }
        break;
      }
      case "bot_error": {
        const evt = data as BotErrorEvent;
        setStatus("error", evt.error);
        break;
      }
      case "transcript": {
        const evt = data as TranscriptEvent;
        addTranscriptLine({
          speaker: evt.speaker,
          text: evt.text,
          timestamp: evt.timestamp,
        });
        break;
      }
      case "context_update": {
        const evt = data as ContextUpdateEvent;
        setDuration(evt.duration);
        break;
      }
      case "speaker_active": {
        const evt = data as SpeakerActiveEvent;
        setActiveSpeaker(evt.isActive ? evt.participantName : null);
        break;
      }
      case "speaking_stats": {
        const evt = data as SpeakingStatsEvent;
        updateSpeakingStats(evt.stats);
        break;
      }
      case "participant_event": {
        const evt = data as ParticipantEventWs;
        addParticipantEvent({
          type: evt.eventType!,
          participant: evt.participant,
          timestamp: evt.timestamp,
        });
        break;
      }
    }
  }, [setStatus, setDuration, addTranscriptLine, updateSpeakingStats, setActiveSpeaker, addParticipantEvent]);

  // ─── Duration Timer ─────────────────────────────────────────────

  const startDurationTimer = useCallback(() => {
    stopDurationTimer();
    durationTimerRef.current = setInterval(() => {
      useMeetingBotStore.setState((s) => ({ duration: s.duration + 1 }));
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  // ─── Connect when transcriptWsUrl is available ──────────────────

  useEffect(() => {
    if (transcriptWsUrl && status !== "idle" && status !== "done" && status !== "error") {
      connectWs(transcriptWsUrl);
    }
    return () => {
      disconnectWs();
      stopDurationTimer();
    };
  }, [transcriptWsUrl]);

  // ─── Connect inference WebSocket when inference routing is active ──

  useEffect(() => {
    if (
      inferenceStreamId &&
      status === "recording" &&
      (routingMode === "inference" || routingMode === "both") &&
      !InferenceService.isWebSocketConnected()
    ) {
      console.log(`[MeetingBot] Connecting inference WebSocket for stream ${inferenceStreamId}`);
      InferenceService.connectWebSocket(inferenceStreamId);
    }
  }, [inferenceStreamId, status, routingMode]);

  // ─── Polling fallback (when webhooks don't reach local backend) ──

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollBotIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Only restart polling when botId changes, not on every status change
    if (pollBotIdRef.current === botId && pollTimerRef.current) return;
    pollBotIdRef.current = botId;

    if (!botId || status === "idle" || status === "done" || status === "error") {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    // Poll every 15 seconds (avoid rate limits on production)
    console.log(`[MeetingBot] Polling started for bot ${botId}, status: ${status}`);
    pollTimerRef.current = setInterval(async () => {
      try {
        const result = await recallService.pollBotStatus(botId);
        console.log(`[MeetingBot] Poll result: status=${result.status}, lines=${result.transcriptLineCount}`);
        if (!result.success) return;

        // Update status
        if (result.status !== status) {
          setStatus(result.status as BotStatus);
          if (result.status === "recording") {
            startDurationTimer();
          }
          if (result.status === "done" || result.status === "error") {
            stopDurationTimer();
          }
        }

        // Update transcript lines
        if (result.transcriptLines && result.transcriptLines.length > 0) {
          const store = useMeetingBotStore.getState();
          const existingCount = store.transcriptLines.length;
          // Only add new lines (Recall.ai returns all lines each time)
          const newLines = result.transcriptLines.slice(existingCount);
          for (const line of newLines) {
            addTranscriptLine(line);
          }
        }

        // Update duration
        if (result.duration) {
          setDuration(result.duration);
        }
      } catch (err: any) {
        // Don't treat rate limits or network errors as bot errors
        const msg = err?.message || "";
        if (msg.includes("429") || msg.includes("Rate limit")) {
          console.log("[MeetingBot] Poll rate limited, backing off");
        }
        // Silent otherwise — polling is best-effort
      }
    }, 15000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [botId, status]);

  // ─── Encrypt + upload transcript when session ends ──────────────

  const prevStatusRef = useRef<BotStatus>("idle");
  useEffect(() => {
    const wasDone = status === "done" && prevStatusRef.current === "recording";
    prevStatusRef.current = status;
    if (!wasDone) return;

    const store = useMeetingBotStore.getState();
    if (store.fullTranscript.length === 0 || !store.botId) return;

    (async () => {
      try {
        const transcriptJson = JSON.stringify(store.fullTranscript);
        const activeGatewayId = useGatewayStore.getState().activeGatewayId;

        let encryptedBlob = transcriptJson;
        if (activeGatewayId) {
          encryptedBlob = await e2eService.encryptForStorage(activeGatewayId, transcriptJson);
        }

        await recallService.uploadEncryptedTranscript(
          store.botId!,
          encryptedBlob,
          activeGatewayId || undefined,
        );
        console.log("[MeetingBot] Encrypted transcript uploaded");

        // Auto-generate post-meeting summary via Gateway agent
        if (
          (store.routingMode === "gateway" || store.routingMode === "both") &&
          activeGatewayId &&
          gatewayClient.getStatus() === "connected"
        ) {
          try {
            const gateways = useGatewayStore.getState().gateways;
            const gw = gateways.find((g) => g.id === activeGatewayId);
            const provider = getProvider(gw?.providerType || "openclaw");
            const sessionKey = "main";

            // Build the summary request with full transcript context
            const lastLines = store.fullTranscript.slice(-100);
            const transcriptBlock = lastLines
              .map((l) => `[${l.timestamp?.slice(11, 19) || ""}] ${l.speaker}: ${l.text}`)
              .join("\n");

            const summaryPrompt = `[MEETING ENDED — Full transcript (last ${lastLines.length} lines)]\n${transcriptBlock}\n---\nPlease provide a concise post-meeting summary: key decisions, action items, open questions, and next steps.`;

            const chatReq = provider.buildChatSend(sessionKey, summaryPrompt, makeIdempotencyKey(`summary_${store.botId}`));
            await gatewayClient.request(chatReq.method, chatReq.params);
            console.log("[MeetingBot] Post-meeting summary requested");
          } catch (summaryErr: any) {
            console.warn("[MeetingBot] Summary generation failed:", summaryErr.message);
          }
        }
      } catch (err: any) {
        console.warn("[MeetingBot] Transcript upload failed:", err.message);
      }
    })();
  }, [status]);

  // ─── Sync with server on mount (recover from app restart) ───────
  // Uses store-level guard to ensure this only fires once across all mounts.

  useEffect(() => {
    useMeetingBotStore.getState().syncWithServer();
  }, []);

  // ─── Public API ─────────────────────────────────────────────────

  return {
    // State
    botId,
    status,
    platform,
    meetingUrl,
    routingMode,
    error,
    duration,
    transcriptLines,
    fullTranscript,
    actionItems,
    inferenceStreamId,
    estimatedCostPerHour,
    speakingStats,
    activeSpeaker,
    participantEvents,
    isActive: status === "recording" || status === "joining" || status === "in_waiting_room",
    isRecording: status === "recording",

    // Actions
    deployBot,
    removeBot,
    addActionItem,
    confirmActionItem,
    dismissActionItem,
    pushActionItem,
    reset,
  };
}
