// Text-to-Speech service — ElevenLabs integration
// Uses expo-audio for playback (SDK 55+)

import { StreamIOAPIConfig } from '@/constants/streamio/config';
import { useStreamIOAuthStore } from '@/stores/streamio/authStore';
import * as AudioSession from './audioSessionService';

export type VoiceProfile = 'general' | 'technical' | 'warning' | 'discovery' | 'success' | 'professional';

interface VoiceConfig {
  voiceId: string;
  name: string;
  stability: number;
  similarityBoost: number;
  style: number;
}

export const VOICE_PROFILES: Record<VoiceProfile, VoiceConfig> = {
  general: { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', stability: 0.5, similarityBoost: 0.75, style: 0 },
  technical: { voiceId: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', stability: 0.6, similarityBoost: 0.8, style: 0 },
  warning: { voiceId: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', stability: 0.4, similarityBoost: 0.75, style: 0.3 },
  discovery: { voiceId: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', stability: 0.45, similarityBoost: 0.75, style: 0.2 },
  success: { voiceId: 'jBpfuIE2acCO8z3wKNLl', name: 'Gigi', stability: 0.5, similarityBoost: 0.75, style: 0.4 },
  professional: { voiceId: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', stability: 0.6, similarityBoost: 0.8, style: 0 },
};

const CLASSIFICATION_RULES: [VoiceProfile, RegExp][] = [
  ['warning', /error|warning|caution|danger|critical|fail|broke|issue/i],
  ['success', /success|complete|done|finished|accomplished|passed/i],
  ['discovery', /found|discover|interest|notice|detect|reveal|curious/i],
  ['technical', /algorithm|implementation|function|class|method|architecture/i],
  ['professional', /report|analysis|assessment|compliance|regulation|legal/i],
];

// Lazy-load expo-audio
let audioMod: typeof import('expo-audio') | null = null;
let audioLoadAttempted = false;
let currentPlayer: any = null;

function getAudioModule(): typeof import('expo-audio') | null {
  if (audioMod) return audioMod;
  if (audioLoadAttempted) return null;
  audioLoadAttempted = true;
  try {
    audioMod = require('expo-audio');
    return audioMod;
  } catch {
    console.warn('expo-audio not available — TTS playback disabled');
    return null;
  }
}

// Auto-classify text to a voice profile
export function classifyVoice(text: string): VoiceProfile {
  for (const [profile, pattern] of CLASSIFICATION_RULES) {
    if (pattern.test(text)) return profile;
  }
  return 'general';
}

// Clean text for TTS (strip markdown, code blocks, ANSI)
export function cleanTextForTTS(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '') // code blocks
    .replace(/`[^`]{0,15}`/g, '') // short inline code
    .replace(/#{1,6}\s/g, '') // headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // images
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1') // bold/italic
    .replace(/^\s*[-*+]\s/gm, '') // list markers
    .replace(/\x1b\[[0-9;]*m/g, '') // ANSI
    .replace(/\n{2,}/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Synthesize speech via ElevenLabs API
export async function synthesize(
  text: string,
  profile?: VoiceProfile,
  speed: number = 1.0,
): Promise<ArrayBuffer | null> {
  const cleanedText = cleanTextForTTS(text);
  if (!cleanedText || cleanedText.length < 3) return null;

  const voiceProfile = profile || classifyVoice(cleanedText);
  const voice = VOICE_PROFILES[voiceProfile];

  // Get API key from env or config
  const apiKey = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY || '';
  if (!apiKey) {
    console.warn('ElevenLabs API key not configured');
    return null;
  }

  const url = `${StreamIOAPIConfig.external.elevenLabsTTS}/${voice.voiceId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: cleanedText,
      model_id: 'eleven_v3',
      voice_settings: {
        stability: voice.stability,
        similarity_boost: voice.similarityBoost,
        style: voice.style,
        use_speaker_boost: true,
        speed,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`TTS API error: ${response.status}`);
  }

  return response.arrayBuffer();
}

// Play audio using expo-audio — returns a Promise that resolves when playback finishes
export async function speak(
  text: string,
  profile?: VoiceProfile,
  speed: number = 1.0,
): Promise<void> {
  const mod = getAudioModule();
  if (!mod) throw new Error('Audio module not available');

  // Stop any current playback
  await stopSpeaking();

  const audioData = await synthesize(text, profile, speed);
  if (!audioData) return;

  // Convert to base64 data URI
  const base64 = arrayBufferToBase64(audioData);
  const uri = `data:audio/mpeg;base64,${base64}`;

  await AudioSession.acquireForPlayback();

  // Use createAudioPlayer for imperative playback
  const player = mod.createAudioPlayer(uri);
  currentPlayer = player;

  return new Promise<void>((resolve) => {
    player.addListener('playbackStatusUpdate', (status: any) => {
      if (status.playing === false && status.currentTime > 0) {
        player.remove();
        if (currentPlayer === player) currentPlayer = null;
        resolve();
      }
    });

    // Safety timeout — don't block forever
    setTimeout(() => {
      if (currentPlayer === player) {
        try { player.remove(); } catch {}
        currentPlayer = null;
      }
      resolve();
    }, 60000);

    player.play();
  });
}

/** Stop current TTS playback immediately (alias for barge-in support). */
export const stopPlayback = stopSpeaking;

export async function stopSpeaking(): Promise<void> {
  if (currentPlayer) {
    try {
      currentPlayer.pause();
      currentPlayer.remove();
    } catch {
      // Ignore cleanup errors
    }
    currentPlayer = null;
  }
}

export function isSpeaking(): boolean {
  return currentPlayer != null;
}

export function getVoiceProfiles(): { key: VoiceProfile; name: string }[] {
  return Object.entries(VOICE_PROFILES).map(([key, config]) => ({
    key: key as VoiceProfile,
    name: config.name,
  }));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
