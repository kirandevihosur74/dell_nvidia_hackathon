// ElevenLabs TTS service — direct API calls for text-to-speech
// STT has been moved to services/streamio/sttService.ts (backend proxy)
// Uses expo-audio for playback (SDK 55+)

const ELEVENLABS_API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY || 'sk_32d2e0ae3933749e9aa7e95e419980ca40822271b7fe84fc';
const ELEVENLABS_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

// --------------- Audio module (lazy-loaded) ---------------

let audioModuleRef: typeof import('expo-audio') | null = null;
let audioLoadAttempted = false;

function getAudioModule(): typeof import('expo-audio') | null {
  if (audioModuleRef) return audioModuleRef;
  if (audioLoadAttempted) return null;
  audioLoadAttempted = true;
  try {
    audioModuleRef = require('expo-audio');
    return audioModuleRef;
  } catch {
    console.warn('[ElevenLabs] expo-audio native module not available — requires dev build');
    return null;
  }
}

// --------------- TTS (Text-to-Speech) ---------------

export type VoiceProfile =
  | 'general' | 'technical' | 'warning' | 'discovery' | 'success' | 'professional'
  | 'fisayo' | 'dayo' | 'olaniyi' | 'paulina' | 'dr_abebe' | 'muyiwa' | 'victor';

interface VoiceConfig {
  voiceId: string;
  name: string;
  stability: number;
  similarityBoost: number;
  style: number;
}

export const VOICE_PROFILES: Record<VoiceProfile, VoiceConfig> = {
  // Built-in ElevenLabs voices
  general:      { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah',     stability: 0.5,  similarityBoost: 0.75, style: 0 },
  technical:    { voiceId: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel',    stability: 0.6,  similarityBoost: 0.8,  style: 0 },
  warning:      { voiceId: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', stability: 0.4,  similarityBoost: 0.75, style: 0.3 },
  discovery:    { voiceId: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily',      stability: 0.45, similarityBoost: 0.75, style: 0.2 },
  success:      { voiceId: 'jBpfuIE2acCO8z3wKNLl', name: 'Gigi',      stability: 0.5,  similarityBoost: 0.75, style: 0.4 },
  professional: { voiceId: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam',      stability: 0.6,  similarityBoost: 0.8,  style: 0 },
  // Nigerian voices
  fisayo:       { voiceId: 'it5NMxoQQ2INIh4XcO44', name: 'Fisayo',    stability: 0.5,  similarityBoost: 0.75, style: 0 },
  dayo:         { voiceId: 'zwbf3iHXH6YGoTCPStfx', name: 'Dayo',      stability: 0.5,  similarityBoost: 0.75, style: 0 },
  olaniyi:      { voiceId: 'U7wWSnxIJwCjioxt86mk', name: 'Olaniyi',   stability: 0.5,  similarityBoost: 0.75, style: 0 },
  paulina:      { voiceId: 'fGT7Mus3w81KxMRpFtGh', name: 'Paulina',   stability: 0.5,  similarityBoost: 0.75, style: 0 },
  dr_abebe:     { voiceId: '3mwVS2Cu52S8MzAVx66c', name: 'Dr. Abebe', stability: 0.5,  similarityBoost: 0.75, style: 0 },
  muyiwa:       { voiceId: 'r9DosIwaFvTjhC7gp1d2', name: 'Muyiwa',    stability: 0.5,  similarityBoost: 0.75, style: 0 },
  victor:       { voiceId: 'neMPCpWtBwWZhxEC8qpe', name: 'Victor',    stability: 0.5,  similarityBoost: 0.75, style: 0 },
};

const CLASSIFICATION_RULES: [VoiceProfile, RegExp][] = [
  ['warning', /error|warning|caution|danger|critical|fail|broke|issue/i],
  ['success', /success|complete|done|finished|accomplished|passed/i],
  ['discovery', /found|discover|interest|notice|detect|reveal|curious/i],
  ['technical', /algorithm|implementation|function|class|method|architecture/i],
  ['professional', /report|analysis|assessment|compliance|regulation|legal/i],
];

let currentPlayer: any = null;

export function classifyVoice(text: string): VoiceProfile {
  for (const [profile, pattern] of CLASSIFICATION_RULES) {
    if (pattern.test(text)) return profile;
  }
  return 'general';
}

export function cleanTextForTTS(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]{0,15}`/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')
    .replace(/^\s*[-*+]\s/gm, '')
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function synthesize(
  text: string,
  profile?: VoiceProfile,
  speed: number = 1.0,
): Promise<ArrayBuffer | null> {
  const cleanedText = cleanTextForTTS(text);
  if (!cleanedText || cleanedText.length < 3) return null;

  const apiKey = ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.warn('[ElevenLabs] API key not configured');
    return null;
  }

  const voiceProfile = profile || classifyVoice(cleanedText);
  const voice = VOICE_PROFILES[voiceProfile];
  const url = `${ELEVENLABS_TTS_URL}/${voice.voiceId}`;

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

export async function speak(
  text: string,
  profile?: VoiceProfile,
  speed: number = 1.0,
): Promise<void> {
  const mod = getAudioModule();
  if (!mod) throw new Error('Audio module not available');

  await stopSpeaking();

  const audioData = await synthesize(text, profile, speed);
  if (!audioData) return;

  const base64 = arrayBufferToBase64(audioData);
  const uri = `data:audio/mpeg;base64,${base64}`;

  await mod.setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
  });

  const player = mod.createAudioPlayer(uri);
  currentPlayer = player;

  return new Promise<void>((resolve) => {
    player.addListener('playbackStatusUpdate', (s: any) => {
      if (s.playing === false && s.currentTime > 0) {
        player.remove();
        if (currentPlayer === player) currentPlayer = null;
        resolve();
      }
    });

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

export async function stopSpeaking(): Promise<void> {
  if (currentPlayer) {
    try {
      currentPlayer.pause();
      currentPlayer.remove();
    } catch {}
    currentPlayer = null;
  }
}

export function isSpeaking(): boolean {
  return currentPlayer != null;
}
