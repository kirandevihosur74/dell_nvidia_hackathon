// Voice TTS service — ElevenLabs with expo-speech fallback
import * as ElevenLabs from "./elevenLabsService";
import type { VoiceProfile } from "./elevenLabsService";
import type { VoiceProfileOption } from "@/stores/settingsStore";

/**
 * Play TTS using ElevenLabs API with the user's selected voice profile.
 * "auto" lets ElevenLabs service auto-classify the voice from content.
 */
export async function playTTSWithProfile(
  text: string,
  profileOption: VoiceProfileOption = "auto",
): Promise<void> {
  try {
    const profile = profileOption === "auto" ? undefined : (profileOption as VoiceProfile);
    await ElevenLabs.speak(text, profile);
  } catch {
    return playLocalTTS(text);
  }
}

/**
 * Play TTS using ElevenLabs with auto-detected voice. Falls back to on-device TTS.
 */
export async function playTTS(text: string): Promise<void> {
  return playTTSWithProfile(text, "auto");
}

/**
 * Use expo-speech for on-device TTS (works in Expo Go, no native module needed).
 */
export async function playLocalTTS(text: string): Promise<void> {
  const Speech = await import("expo-speech");
  return new Promise((resolve) => {
    Speech.speak(text, {
      onDone: resolve,
      onError: () => resolve(),
    });
  });
}

/**
 * Stop any active TTS playback.
 */
export async function stopTTS(): Promise<void> {
  await ElevenLabs.stopSpeaking();
}
