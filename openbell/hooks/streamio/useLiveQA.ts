// useLiveQA — React hook exposing Q&A state and actions to stream UI
//
// Connects MicFAB actions to liveQAService, manages PTT recording flow.
// Handles error scenarios with console.warn notifications.

import { useCallback } from 'react';
import { useStreamIOInferenceStore } from '@/stores/streamio/inferenceStore';
import { useToastStore } from '@/stores/toastStore';
import { QAStatus } from '@/types/streamio/inference';
import * as LiveQA from '@/services/streamio/liveQAService';
import * as STTService from '@/services/streamio/sttService';
import * as AudioSession from '@/services/streamio/audioSessionService';

interface UseLiveQAReturn {
  qaStatus: QAStatus;
  qaSessionActive: boolean;
  micAvailable: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  interrupt: () => void;
}

export function useLiveQA(): UseLiveQAReturn {
  const qaStatus = useStreamIOInferenceStore((s) => s.qaStatus);
  const qaSessionActive = useStreamIOInferenceStore((s) => s.qaSessionActive);
  const micAvailable = STTService.isAudioAvailable();

  const startRecording = useCallback(async () => {
    console.log('[useLiveQA] startRecording called, qaStatus:', qaStatus);

    // Check if audio is available at all
    if (!STTService.isAudioAvailable()) {
      console.warn('[useLiveQA] Audio not available');
      useToastStore.getState().error('Microphone access needed for Q&A');
      return;
    }

    // If currently speaking (TTS playing), barge-in: stop TTS then start recording
    if (qaStatus === 'speaking') {
      LiveQA.interruptResponse();
    }

    useStreamIOInferenceStore.getState().setQAStatus('recording');

    const started = await STTService.startRecording(true); // useAudioSession=true for Q&A
    console.log('[useLiveQA] startRecording result:', started);
    if (!started) {
      useStreamIOInferenceStore.getState().setQAStatus('idle');
      useToastStore.getState().error('Microphone access needed for Q&A');
    }
  }, [qaStatus]);

  const stopRecording = useCallback(async () => {
    console.log('[useLiveQA] stopRecording called');
    useStreamIOInferenceStore.getState().setQAStatus('processing');

    // Stop recording and transcribe
    const uri = await STTService.stopRecording();
    console.log('[useLiveQA] stopRecording uri:', uri);
    if (!uri) {
      console.warn('[useLiveQA] No recording URI returned');
      useStreamIOInferenceStore.getState().setQAStatus('idle');
      useToastStore.getState().error('Recording failed — no audio captured');
      return;
    }

    try {
      console.log('[useLiveQA] Starting transcription...');
      const text = await STTService.transcribe(uri);
      // Release the recorder reference now that transcription has read the file
      await STTService.releaseRecorder();
      console.log('[useLiveQA] Transcription result:', text);
      if (!text || !text.trim()) {
        console.log('[useLiveQA] Empty transcription, returning to idle');
        useStreamIOInferenceStore.getState().setQAStatus('idle');
        AudioSession.release();
        useToastStore.getState().warning('No speech detected — try again');
        return;
      }

      // Submit question — liveQAService handles the rest
      console.log('[useLiveQA] Submitting question:', text.trim());
      await LiveQA.askQuestion(text.trim());
    } catch (err: any) {
      console.warn('[useLiveQA] Transcription failed:', err.message);
      await STTService.releaseRecorder();
      useStreamIOInferenceStore.getState().setQAStatus('idle');
      AudioSession.release();
      useToastStore.getState().error("Couldn't understand audio, try again");
    }
  }, []);

  const interrupt = useCallback(() => {
    LiveQA.interruptResponse();
  }, []);

  return {
    qaStatus,
    qaSessionActive,
    micAvailable,
    startRecording,
    stopRecording,
    interrupt,
  };
}
