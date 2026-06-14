import { TouchableOpacity } from "react-native";
import { Volume2, VolumeX, Loader } from "lucide-react-native";
import { useState, useEffect, useCallback } from "react";
import { useThemeStore } from "@/stores/themeStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { playTTSWithProfile, stopTTS, playLocalTTS } from "@/services/voiceService";

// ── Global TTS coordination ──
// Only one VoiceOutputButton can play at a time.
// When a new one starts, the previous one is stopped.
type StopCallback = () => void;
let activeStopCallback: StopCallback | null = null;

/** Stop any currently playing TTS from any VoiceOutputButton instance. */
export function stopAllTTS(): void {
  if (activeStopCallback) {
    activeStopCallback();
    activeStopCallback = null;
  }
  stopTTS();
}

interface Props {
  text: string;
}

export function VoiceOutputButton({ text }: Props) {
  const { theme } = useThemeStore();
  const { voiceOutputEnabled, voiceProfile } = useSettingsStore();
  const [playing, setPlaying] = useState(false);

  // Register cleanup on unmount
  useEffect(() => {
    return () => {
      if (playing) {
        stopTTS();
        if (activeStopCallback === stopSelf) activeStopCallback = null;
      }
    };
  }, [playing]);

  const stopSelf = useCallback(() => {
    setPlaying(false);
  }, []);

  if (!voiceOutputEnabled) return null;

  const handlePlay = async () => {
    if (playing) {
      await stopTTS();
      setPlaying(false);
      if (activeStopCallback === stopSelf) activeStopCallback = null;
      return;
    }

    // Stop any other playing instance first
    stopAllTTS();

    setPlaying(true);
    activeStopCallback = stopSelf;

    try {
      await playTTSWithProfile(text, voiceProfile);
    } catch {
      await playLocalTTS(text);
    } finally {
      setPlaying(false);
      if (activeStopCallback === stopSelf) activeStopCallback = null;
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePlay}
      activeOpacity={0.7}
      hitSlop={8}
      style={{ padding: 4 }}
    >
      {playing ? (
        <VolumeX size={14} color={theme.primary} />
      ) : (
        <Volume2 size={14} color={theme.textTertiary} />
      )}
    </TouchableOpacity>
  );
}
