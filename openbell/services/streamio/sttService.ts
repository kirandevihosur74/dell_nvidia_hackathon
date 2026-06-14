// Speech-to-Text service — ElevenLabs STT + expo-audio recording
// Uses expo-audio (modern replacement for expo-av in SDK 55+)

import { StreamIOAPIConfig } from '@/constants/streamio/config';
import { streamIOApiClient } from '@/services/streamio/apiClient';
import * as AudioSession from './audioSessionService';

// Lazy-load expo-audio to avoid crash if native module missing
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
    console.warn('[STT] expo-audio native module not available — audio recording requires a dev build (not Expo Go)');
    return null;
  }
}

/** Returns true if audio recording is supported in this runtime. */
export function isAudioAvailable(): boolean {
  return getAudioModule() !== null;
}

export type RecordingStatus = 'idle' | 'requesting-permission' | 'recording' | 'transcribing' | 'error';

let status: RecordingStatus = 'idle';
let statusCallback: ((status: RecordingStatus) => void) | null = null;
let activeRecorder: any = null; // AudioRecorder instance

function setStatus(newStatus: RecordingStatus) {
  status = newStatus;
  statusCallback?.(newStatus);
}

export function onStatusChange(callback: (status: RecordingStatus) => void): () => void {
  statusCallback = callback;
  return () => { statusCallback = null; };
}

export function getStatus(): RecordingStatus {
  return status;
}

// Request microphone permission
export async function requestPermission(): Promise<boolean> {
  const mod = getAudioModule();
  if (!mod) return false;

  try {
    const { granted } = await mod.requestRecordingPermissionsAsync();
    return granted;
  } catch (err: any) {
    console.warn('Microphone permission request failed:', err.message);
    return false;
  }
}

// Start recording
// When useAudioSession=true, acquires exclusive audio session (for Q&A PTT mode).
// When false, uses the lightweight audio mode config (for passive audio capture).
export async function startRecording(useAudioSession = false): Promise<boolean> {
  const mod = getAudioModule();
  if (!mod) {
    setStatus('error');
    return false;
  }

  if (activeRecorder) {
    await stopRecording();
  }

  setStatus('requesting-permission');
  const hasPermission = await requestPermission();
  if (!hasPermission) {
    setStatus('error');
    return false;
  }

  try {
    if (useAudioSession) {
      // Q&A mode — acquire exclusive audio session (stops TTS, pauses passive capture)
      await AudioSession.acquireForRecording();
    } else {
      // Passive mode — lightweight config, doesn't interfere with camera
      await mod.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
    }

    // Record as CAF (Core Audio Format) with AAC encoding — matches executive coach backend
    const recordingOptions = {
      ...mod.RecordingPresets.HIGH_QUALITY,
      extension: '.caf',
      ios: {
        ...mod.RecordingPresets.HIGH_QUALITY.ios,
        extension: '.caf',
      },
    };
    const recorder = new mod.AudioModule.AudioRecorder(recordingOptions);
    await recorder.prepareToRecordAsync();
    recorder.record();
    console.log('[STT] Recording started (M4A/AAC, prepared)');
    activeRecorder = recorder;
    setStatus('recording');
    return true;
  } catch (error: any) {
    console.error('Recording start failed:', error);
    setStatus('error');
    return false;
  }
}

// Stop recording and return the file URI via the native didFinish event.
// expo-audio v55's AudioRecorder only makes the file accessible through
// the recordingStatusUpdate event's url field after native finalization.
let lastRecordingUrl: string | null = null;

export async function stopRecording(): Promise<string | null> {
  if (!activeRecorder) return null;

  try {
    const uri: string | null = activeRecorder.uri;
    console.log('[STT] Stopping recorder, URI:', uri);

    const { File: FSFile, Paths, Directory } = require('expo-file-system/next');
    const cacheDir = new Directory(Paths.cache, 'ExpoAudio');

    // Snapshot files BEFORE stop to detect the new one after
    const filesBefore = new Set<string>();
    if (cacheDir.exists) {
      for (const f of cacheDir.list()) {
        filesBefore.add(f.uri);
      }
    }
    console.log('[STT] Files before stop:', filesBefore.size);

    // Stop the recorder — this finalizes and writes the file
    await activeRecorder.stop();
    activeRecorder = null;
    console.log('[STT] Recorder stopped');

    // Find the newest file that appeared after stop
    if (cacheDir.exists) {
      const filesAfter = cacheDir.list();
      let newestFile: any = null;
      let newestTime = 0;

      for (const f of filesAfter) {
        // Look for new files OR the most recently modified file
        if (!filesBefore.has(f.uri) || f.modificationTime > newestTime) {
          if (f.modificationTime > newestTime) {
            newestTime = f.modificationTime;
            newestFile = f;
          }
        }
      }

      if (newestFile) {
        console.log('[STT] Found recording file:', newestFile.uri, 'size:', newestFile.size);
        lastRecordingUrl = newestFile.uri;
        return newestFile.uri;
      }
    }

    console.warn('[STT] No recording file found after stop');
    lastRecordingUrl = uri;
    return uri;
  } catch (error: any) {
    console.error('Recording stop failed:', error);
    activeRecorder = null;
    return null;
  }
}

export function getLastRecordingUrl(): string | null {
  return lastRecordingUrl;
}

export async function releaseRecorder(): Promise<void> {
  lastRecordingUrl = null;
}

// Transcribe audio via backend proxy (avoids expo-audio file system issues)
export async function transcribe(audioUri: string): Promise<string | null> {
  setStatus('transcribing');

  try {
    console.log('[STT] Transcribing:', audioUri);

    // Read the file using expo-file-system File (which implements Blob)
    const { File: FSFile } = require('expo-file-system/next');
    const audioFile = new FSFile(audioUri);
    console.log('[STT] File exists:', audioFile.exists, 'size:', audioFile.size);

    if (!audioFile.exists || audioFile.size === 0) {
      throw new Error('Recording file not found');
    }

    // Read as ArrayBuffer, convert to base64, send through backend proxy
    const arrayBuffer = await audioFile.arrayBuffer();
    console.log('[STT] Read ArrayBuffer, byteLength:', arrayBuffer.byteLength);

    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    console.log('[STT] Base64 length:', base64.length);

    // Send to backend proxy for ElevenLabs STT
    console.log('[STT] Sending to backend proxy, base64 length:', base64.length);
    const result = await streamIOApiClient.post<{ success: boolean; text: string }>('/api/v1/inference/transcribe', {
      audioData: base64,
      mimeType: 'audio/x-caf',
    }, undefined, 30000);

    console.log('[STT] Backend response:', JSON.stringify(result));
    setStatus('idle');
    return result.text || null;
  } catch (error: any) {
    console.error('[STT] Transcription error:', error.message);
    setStatus('error');
    throw error;
  }
}

// Convenience: record → stop → transcribe
export async function recordAndTranscribe(): Promise<string | null> {
  const uri = await stopRecording();
  if (!uri) {
    setStatus('idle');
    return null;
  }
  try {
    const result = await transcribe(uri);
    await releaseRecorder();
    return result;
  } catch (err) {
    await releaseRecorder();
    throw err;
  }
}

// Cancel active recording without transcribing
export async function cancelRecording(): Promise<void> {
  if (activeRecorder) {
    try {
      await activeRecorder.stop();
    } catch {
      // Ignore
    }
    activeRecorder = null;
  }
  setStatus('idle');
}
