// ElevenLabs WebSocket streaming TTS client
//
// Streams text tokens from Gemini response directly to ElevenLabs WS,
// receives audio chunks, decodes, and plays them sequentially via expo-audio.
// Falls back to REST TTS if the WebSocket connection fails.

import { StreamIOAPIConfig } from '@/constants/streamio/config';
import { VoiceProfile, synthesize, cleanTextForTTS } from '@/services/streamio/ttsService';
import * as AudioSession from './audioSessionService';

// ─── Voice Config ───────────────────────────────────────────────────

const VOICE_IDS: Record<string, string> = {
  general: 'EXAVITQu4vr4xnSDxMaL',     // Sarah
  technical: 'onwK4e9ZLuTAKqWW03F9',     // Daniel
  professional: 'TX3LPaxmHKxFdv7VOQHJ',  // Liam
};

// ─── State ──────────────────────────────────────────────────────────

let ws: WebSocket | null = null;
let streaming = false;
let currentVoiceId = VOICE_IDS.general;
let audioQueue: string[] = [];   // base64 MP3 chunks
let isPlayingChunk = false;
let currentPlayer: any = null;
let fullResponseText = '';       // accumulate for REST fallback
let wsFailed = false;

// Lazy-load expo-audio
let audioMod: typeof import('expo-audio') | null = null;
let audioLoadAttempted = false;

function getAudioModule(): typeof import('expo-audio') | null {
  if (audioMod) return audioMod;
  if (audioLoadAttempted) return null;
  audioLoadAttempted = true;
  try {
    audioMod = require('expo-audio');
    return audioMod;
  } catch {
    return null;
  }
}

// Callback when TTS finishes all audio playback
let onPlaybackComplete: (() => void) | null = null;

export function setOnPlaybackComplete(callback: (() => void) | null): void {
  onPlaybackComplete = callback;
}

// ─── Public API ─────────────────────────────────────────────────────

/** Open a streaming TTS session via ElevenLabs WebSocket. */
export function openStream(voiceProfile?: VoiceProfile): void {
  const apiKey = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY || '';
  if (!apiKey) {
    console.warn('[TTS Stream] No ElevenLabs API key configured');
    wsFailed = true;
    return;
  }

  currentVoiceId = VOICE_IDS[voiceProfile || 'general'] || VOICE_IDS.general;
  fullResponseText = '';
  audioQueue = [];
  isPlayingChunk = false;
  wsFailed = false;
  streaming = true;

  const wsUrl = `${StreamIOAPIConfig.external.elevenLabsWSS}/${currentVoiceId}/stream-input?model_id=eleven_v3&xi_api_key=${apiKey}`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[TTS Stream] WebSocket connected');
      // Send BOS (Beginning of Stream)
      ws!.send(JSON.stringify({
        text: ' ',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
        },
        xi_api_key: apiKey,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.audio) {
          // Received base64-encoded MP3 audio chunk
          audioQueue.push(data.audio);
          processAudioQueue();
        }
      } catch {
        // Ignore unparseable messages
      }
    };

    ws.onerror = (event) => {
      console.warn('[TTS Stream] WebSocket error:', event);
      wsFailed = true;
    };

    ws.onclose = (event) => {
      console.log('[TTS Stream] WebSocket closed:', event.code, event.reason);
      ws = null;

      // If we still have queued audio, let it finish playing
      if (audioQueue.length === 0 && !isPlayingChunk && streaming) {
        finishPlayback();
      }
    };
  } catch (err: any) {
    console.warn('[TTS Stream] Failed to open WebSocket:', err.message);
    wsFailed = true;
    ws = null;
  }
}

/** Feed a text token from the Gemini response into the TTS stream. */
export function feedToken(token: string): void {
  fullResponseText += token;

  if (wsFailed || !ws || ws.readyState !== WebSocket.OPEN) {
    // Accumulate text for REST fallback — will be handled in flush()
    return;
  }

  ws.send(JSON.stringify({
    text: token,
    try_trigger_generation: true,
  }));
}

/** Signal end of response — flush remaining audio. */
export function flush(): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    // Send EOS (End of Stream)
    ws.send(JSON.stringify({ text: '' }));
  } else if (wsFailed && fullResponseText.trim()) {
    // WebSocket failed — fall back to REST TTS
    fallbackToREST(fullResponseText);
  }

  streaming = false;
}

/** Stop playback + close stream (barge-in). */
export function stop(): void {
  streaming = false;
  audioQueue = [];
  fullResponseText = '';
  wsFailed = false;

  // Close WebSocket
  if (ws) {
    try {
      ws.close();
    } catch {
      // Ignore
    }
    ws = null;
  }

  // Stop current audio player
  if (currentPlayer) {
    try {
      currentPlayer.pause();
      currentPlayer.remove();
    } catch {
      // Ignore
    }
    currentPlayer = null;
  }
  isPlayingChunk = false;
}

/** Returns true if a TTS stream is active. */
export function isStreaming(): boolean {
  return streaming || isPlayingChunk || audioQueue.length > 0;
}

// ─── Audio Playback Queue ───────────────────────────────────────────

async function processAudioQueue(): Promise<void> {
  if (isPlayingChunk || audioQueue.length === 0) return;

  const mod = getAudioModule();
  if (!mod) return;

  isPlayingChunk = true;

  // Ensure audio session is configured for playback
  await AudioSession.acquireForPlayback();

  while (audioQueue.length > 0) {
    const chunk = audioQueue.shift()!;
    try {
      await playBase64Audio(mod, chunk);
    } catch (err: any) {
      console.warn('[TTS Stream] Playback error:', err.message);
    }

    // Check if we were stopped (barge-in)
    if (!streaming && audioQueue.length === 0) break;
  }

  isPlayingChunk = false;

  // If stream is done and no more audio, signal completion
  if (!streaming && audioQueue.length === 0 && !ws) {
    finishPlayback();
  }
}

function playBase64Audio(mod: typeof import('expo-audio'), base64: string): Promise<void> {
  return new Promise((resolve) => {
    const uri = `data:audio/mpeg;base64,${base64}`;

    try {
      const player = mod.createAudioPlayer(uri);
      currentPlayer = player;
      player.play();

      player.addListener('playbackStatusUpdate', (status: any) => {
        if (status.playing === false && status.currentTime > 0) {
          player.remove();
          if (currentPlayer === player) currentPlayer = null;
          resolve();
        }
      });

      // Safety timeout — don't block queue forever
      setTimeout(() => {
        if (currentPlayer === player) {
          try { player.remove(); } catch {}
          currentPlayer = null;
        }
        resolve();
      }, 15000);
    } catch (err: any) {
      console.warn('[TTS Stream] createAudioPlayer failed:', err.message);
      resolve();
    }
  });
}

function finishPlayback(): void {
  AudioSession.release();
  onPlaybackComplete?.();
}

// ─── REST Fallback ──────────────────────────────────────────────────

async function fallbackToREST(text: string): Promise<void> {
  console.log('[TTS Stream] Falling back to REST TTS');
  const mod = getAudioModule();
  if (!mod) return;

  try {
    await AudioSession.acquireForPlayback();

    const audioData = await synthesize(text, 'general');
    if (!audioData) {
      finishPlayback();
      return;
    }

    // Convert ArrayBuffer to base64
    const bytes = new Uint8Array(audioData);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    await playBase64Audio(mod, base64);
    finishPlayback();
  } catch (err: any) {
    console.warn('[TTS Stream] REST fallback failed:', err.message);
    finishPlayback();
  }
}
