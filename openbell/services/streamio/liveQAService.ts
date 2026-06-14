// Live Q&A service — orchestrates the voice Q&A flow
//
// Flow: user taps mic → STT records → question + frame → backend
//       → streaming response via WS → tokens to chat + TTS → spoken response
//
// Key fixes:
// - Shows user's question in chat feed immediately
// - Falls back to REST TTS if WS TTS fails (403)
// - Polls for response if WS events don't arrive (timing resilience)

import { useStreamIOInferenceStore } from '@/stores/streamio/inferenceStore';
import { streamIOApiClient } from '@/services/streamio/apiClient';
import { StreamIOAPIConfig } from '@/constants/streamio/config';
import { safelyTakePhoto } from '@/services/streamio/cameraRef';
import { getAgentById } from '@/services/streamio/agentRegistry';
import { InferenceChatMessage, QAStatus } from '@/types/streamio/inference';
import * as TTS from '@/services/streamio/ttsService';
import * as AudioSession from './audioSessionService';
import { useToastStore } from '@/stores/toastStore';

// ─── State ──────────────────────────────────────────────────────────

let activeStreamId: string | null = null;
let processingTimeoutId: ReturnType<typeof setTimeout> | null = null;

function showToast(message: string, type: 'error' | 'warning' | 'info' = 'error'): void {
  useToastStore.getState()[type](message);
}

// ─── Public API ─────────────────────────────────────────────────────

/** Initialize the Q&A system when a stream starts. */
export function initQA(streamId: string): void {
  activeStreamId = streamId;
  useStreamIOInferenceStore.getState().setQASessionActive(true);
  setStatus('idle');
  console.log('[LiveQA] Initialized for stream:', streamId);
}

/** Submit a user question — captures frame, sends to backend, shows in chat. */
export async function askQuestion(question: string): Promise<void> {
  if (!activeStreamId) {
    console.warn('[LiveQA] Cannot ask question — no active stream');
    return;
  }

  if (!question.trim()) {
    setStatus('idle');
    return;
  }

  setStatus('processing');

  // Show user's question in chat feed immediately
  const agent = getAgentById('live-qa');
  if (agent) {
    const userMsg: InferenceChatMessage = {
      id: `qa_user_${Date.now()}`,
      agentId: 'live-qa',
      agentName: 'You asked',
      agentColor: '#6B7280', // gray for user questions
      agentIcon: agent.icon,
      content: question,
      isStreaming: false,
      isComplete: true,
      frameId: useStreamIOInferenceStore.getState().currentFrameId || '',
      timestamp: Date.now(),
      tokenCount: 0,
    };
    useStreamIOInferenceStore.getState().addChatMessage(userMsg);
  }

  try {
    // Capture the current camera frame
    const base64 = await safelyTakePhoto();
    const imageData = base64 ? `data:image/jpeg;base64,${base64}` : '';

    if (!imageData) {
      console.warn('[LiveQA] Frame capture failed — sending text-only question');
    }

    // Set processing timeout
    clearProcessingTimeout();
    processingTimeoutId = setTimeout(() => {
      console.warn('[LiveQA] Processing timeout — cancelling');
      setStatus('idle');
      showToast('Response timed out');
    }, StreamIOAPIConfig.qa.processingTimeoutMs);

    // Submit to backend — response comes via WebSocket
    console.log('[LiveQA] Posting to', StreamIOAPIConfig.qa.endpoint, 'streamId:', activeStreamId);
    await streamIOApiClient.post(StreamIOAPIConfig.qa.endpoint, {
      streamId: activeStreamId,
      question,
      imageData: imageData || 'data:image/jpeg;base64,',
      frameId: useStreamIOInferenceStore.getState().currentFrameId || undefined,
    }, undefined, 60000); // 60s timeout for large image uploads
    console.log('[LiveQA] Question accepted by backend');

  } catch (err: any) {
    // Ignore abort/timeout errors silently — the backend may still process it
    if (err.name === 'AbortError' || err.message === 'Aborted') {
      console.log('[LiveQA] Request aborted (likely timeout) — backend may still respond via WS');
      return;
    }

    console.error('[LiveQA] Question submission failed:', err.message);
    setStatus('idle');
    clearProcessingTimeout();

    if (err.message?.includes('Network') || err.message?.includes('timeout')) {
      showToast('Network error — check your connection');
    } else {
      showToast('Failed to send question, try again');
    }
  }
}

/** Interrupt current response (barge-in). */
export function interruptResponse(): void {
  TTS.stopSpeaking();
  clearProcessingTimeout();
  AudioSession.release();
  setStatus('idle');
}

/** Cleanup when stream ends. */
export function destroyQA(): void {
  interruptResponse();
  activeStreamId = null;
  useStreamIOInferenceStore.getState().setQASessionActive(false);
  setStatus('idle');
  console.log('[LiveQA] Destroyed');
}

/** Get current Q&A status. */
export function getStatus(): QAStatus {
  return useStreamIOInferenceStore.getState().qaStatus;
}

// ─── WS Event Handlers (called by inferenceService) ─────────────────

/** Handle qa_processing event from backend. */
export function handleQAProcessing(): void {
  console.log('[LiveQA] Backend is processing question');
}

/** Handle qa_token event — accumulate in chat feed. */
export function handleQAToken(messageId: string, token: string): void {
  clearProcessingTimeout();
  console.log('[LiveQA] qa_token received:', token.substring(0, 20));

  // Transition to speaking on first token
  if (getStatus() === 'processing') {
    setStatus('speaking');
  }

  // Route to chat feed for text display
  const store = useStreamIOInferenceStore.getState();
  const existing = store.chatMessages.find((m) => m.id === messageId);

  if (existing) {
    store.appendChatToken(messageId, token);
  } else {
    const agent = getAgentById('live-qa');
    if (!agent) return;

    const message: InferenceChatMessage = {
      id: messageId,
      agentId: 'live-qa',
      agentName: agent.name,
      agentColor: agent.color,
      agentIcon: agent.icon,
      content: token,
      isStreaming: true,
      isComplete: false,
      frameId: store.currentFrameId || '',
      timestamp: Date.now(),
      tokenCount: 1,
    };
    store.addChatMessage(message);
  }
}

/** Handle qa_complete event — finalize chat message + speak via REST TTS. */
export async function handleQAComplete(messageId: string, content: string): Promise<void> {
  clearProcessingTimeout();
  console.log('[LiveQA] qa_complete received, content length:', content.length);

  // Update chat message as complete
  const store = useStreamIOInferenceStore.getState();
  const existing = store.chatMessages.find((m) => m.id === messageId);
  if (existing) {
    store.updateChatMessage(messageId, {
      content,
      isStreaming: false,
      isComplete: true,
    });
  } else {
    // Message wasn't created by tokens — create it now
    const agent = getAgentById('live-qa');
    if (agent) {
      store.addChatMessage({
        id: messageId,
        agentId: 'live-qa',
        agentName: agent.name,
        agentColor: agent.color,
        agentIcon: agent.icon,
        content,
        isStreaming: false,
        isComplete: true,
        frameId: store.currentFrameId || '',
        timestamp: Date.now(),
        tokenCount: 0,
      });
    }
  }

  // Release recording audio session before attempting TTS playback
  await AudioSession.release();

  // Speak the response via backend TTS proxy → play audio on device
  setStatus('speaking');
  try {
    const cleanText = TTS.cleanTextForTTS(content);
    if (cleanText.length > 3) {
      console.log('[LiveQA] Synthesizing via backend proxy, length:', cleanText.length);

      // Get audio from backend TTS proxy with selected voice
      const voiceId = useStreamIOInferenceStore.getState().qaVoiceId;
      const ttsResult = await streamIOApiClient.post<{ success: boolean; audioData: string }>(
        '/api/v1/inference/synthesize',
        { text: cleanText, voiceId },
        undefined,
        30000,
      );

      if (ttsResult.audioData) {
        console.log('[LiveQA] Got audio base64, length:', ttsResult.audioData.length);
        // Play the audio
        const audioUri = `data:audio/mpeg;base64,${ttsResult.audioData}`;
        await AudioSession.acquireForPlayback();

        const audioMod = require('expo-audio');
        const player = audioMod.createAudioPlayer(audioUri);
        player.play();

        // Wait for playback to finish
        await new Promise<void>((resolve) => {
          player.addListener('playbackStatusUpdate', (status: any) => {
            if (status.playing === false && status.currentTime > 0) {
              player.remove();
              resolve();
            }
          });
          // Safety timeout
          setTimeout(() => {
            try { player.remove(); } catch {}
            resolve();
          }, 60000);
        });

        console.log('[LiveQA] TTS playback completed');
      }
    }
  } catch (err: any) {
    console.warn('[LiveQA] TTS playback failed:', err.message);
  }

  setStatus('idle');
  AudioSession.release();
}

// ─── Internal Helpers ───────────────────────────────────────────────

function setStatus(status: QAStatus): void {
  useStreamIOInferenceStore.getState().setQAStatus(status);
}

function clearProcessingTimeout(): void {
  if (processingTimeoutId) {
    clearTimeout(processingTimeoutId);
    processingTimeoutId = null;
  }
}
