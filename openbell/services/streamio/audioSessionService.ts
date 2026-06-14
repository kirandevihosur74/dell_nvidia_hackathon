// Audio session coordinator — mutual exclusion between STT recording and TTS playback
//
// On iOS, the audio session can only be configured for one mode at a time.
// This service ensures STT and TTS don't conflict, and handles barge-in
// (user taps mic while TTS is playing → stop TTS, start recording).

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

// ─── State ──────────────────────────────────────────────────────────

type AudioSessionMode = 'idle' | 'recording' | 'playback';

let currentMode: AudioSessionMode = 'idle';
let passiveAudioPaused = false;

// Callback to pause/resume passive audio capture (set by inferenceService)
let onPassiveAudioPause: (() => void) | null = null;
let onPassiveAudioResume: (() => void) | null = null;

export function setPassiveAudioCallbacks(
  onPause: () => void,
  onResume: () => void,
): void {
  onPassiveAudioPause = onPause;
  onPassiveAudioResume = onResume;
}

// ─── Public API ─────────────────────────────────────────────────────

/** Configure audio session for microphone recording (STT). Stops any TTS playback. */
export async function acquireForRecording(): Promise<void> {
  const mod = getAudioModule();
  if (!mod) return;

  // Pause passive audio capture during Q&A interaction
  if (!passiveAudioPaused) {
    passiveAudioPaused = true;
    onPassiveAudioPause?.();
  }

  // If currently playing TTS, stop it first
  if (currentMode === 'playback') {
    // TTS stop is handled by the caller (liveQAService) via ttsStreamService.stop()
    // We just need to reconfigure the audio session
  }

  try {
    await mod.setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
    currentMode = 'recording';
  } catch (err: any) {
    console.warn('[AudioSession] Failed to acquire for recording:', err.message);
  }
}

/** Configure audio session for speaker output (TTS playback). Must not be recording. */
export async function acquireForPlayback(): Promise<void> {
  const mod = getAudioModule();
  if (!mod) return;

  // Pause passive audio capture during Q&A interaction
  if (!passiveAudioPaused) {
    passiveAudioPaused = true;
    onPassiveAudioPause?.();
  }

  try {
    await mod.setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });
    currentMode = 'playback';
  } catch (err: any) {
    console.warn('[AudioSession] Failed to acquire for playback:', err.message);
  }
}

/** Release audio session — resume passive audio capture if it was paused. */
export async function release(): Promise<void> {
  const mod = getAudioModule();
  if (!mod) return;

  try {
    await mod.setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });
  } catch {
    // Non-critical
  }

  currentMode = 'idle';

  // Resume passive audio capture
  if (passiveAudioPaused) {
    passiveAudioPaused = false;
    onPassiveAudioResume?.();
  }
}

export function isRecording(): boolean {
  return currentMode === 'recording';
}

export function isPlaying(): boolean {
  return currentMode === 'playback';
}

export function getCurrentMode(): AudioSessionMode {
  return currentMode;
}

export function isPassiveAudioPaused(): boolean {
  return passiveAudioPaused;
}
