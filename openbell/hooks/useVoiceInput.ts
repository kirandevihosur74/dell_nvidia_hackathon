import { useState, useCallback } from "react";
import * as STTService from "@/services/streamio/sttService";
import * as Haptics from "expo-haptics";

type VoiceStatus = 'idle' | 'recording' | 'transcribing';

interface UseVoiceInputReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  transcription: string;
  error: string | null;
  handlePress: () => void;
  handleLongPress: () => void;
  clearTranscription: () => void;
}

export function useVoiceInput(
  onTranscription?: (text: string) => void,
): UseVoiceInputReturn {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcription, setTranscription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handlePress = useCallback(async () => {
    if (status === 'idle') {
      // Start recording
      setError(null);
      setTranscription("");

      if (!STTService.isAudioAvailable()) {
        setError("Voice input requires a development build. It is not available in Expo Go.");
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setStatus('recording');
      const started = await STTService.startRecording(false);
      if (!started) {
        setStatus('idle');
        setError("Microphone access denied. Please allow microphone permission in Settings.");
      }
    } else if (status === 'recording') {
      // Stop and transcribe
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setStatus('transcribing');
      try {
        const text = await STTService.recordAndTranscribe();
        if (text) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setTranscription(text);
          onTranscription?.(text);
        } else {
          setError("No speech detected — try again");
        }
      } catch (err: any) {
        setError(err.message || "Transcription failed");
      }
      setStatus('idle');
    }
    // If transcribing, ignore taps
  }, [status, onTranscription]);

  const handleLongPress = useCallback(async () => {
    if (status === 'recording') {
      await STTService.cancelRecording();
      setStatus('idle');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  }, [status]);

  const clearTranscription = useCallback(() => {
    setTranscription("");
  }, []);

  return {
    isRecording: status === 'recording',
    isTranscribing: status === 'transcribing',
    transcription,
    error,
    handlePress,
    handleLongPress,
    clearTranscription,
  };
}
