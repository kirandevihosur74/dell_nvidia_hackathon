// Stream orchestrator — coordinates capture sources, HLS encoding, and server relay
//
// This is the main service that the UI interacts with. It orchestrates:
//   1. Starting/stopping capture (screen or camera)
//   2. Routing captured data to HLS encoder (on-device or server-side)
//   3. Managing stream lifecycle and status
//   4. Duration tracking

import { useStreamIOStreamStore } from '@/stores/streamio/streamStore';
import * as CameraService from './cameraService';
import * as CaptureService from './captureService';
import * as HLSService from './hlsService';
import * as InferenceService from './inferenceService';
import { HLSConfig } from '@/types/streamio';
import { safelyTakePhoto } from './cameraRef';

let durationTimer: ReturnType<typeof setInterval> | null = null;
let frameUnsubscribe: (() => void) | null = null;
let cameraFrameInterval: ReturnType<typeof setInterval> | null = null;

function generateStreamId(): string {
  return `stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function startStream(): Promise<boolean> {
  const streamStore = useStreamIOStreamStore.getState();
  if (streamStore.status === 'streaming' || streamStore.status === 'starting') {
    return false;
  }

  const streamId = generateStreamId();
  streamStore.startStream(streamId);

  const config: HLSConfig = {
    segmentDuration: streamStore.config.segmentDuration,
    playlistSize: streamStore.config.playlistSize,
    resolution: streamStore.config.resolution,
    bitrate: streamStore.config.bitrate,
    transcodingMode: streamStore.config.transcodingMode,
  };

  try {
    // 1. Start HLS encoding pipeline
    console.log('[StreamService] Starting HLS...');
    const hlsStarted = await HLSService.startHLS(config);
    if (!hlsStarted) {
      console.warn('[StreamService] HLS failed to start');
      streamStore.stopStream();
      return false;
    }
    console.log('[StreamService] HLS started successfully');

    // 2. Start capture source
    console.log('[StreamService] Starting capture:', streamStore.captureSource);
    const captureStarted = await startCapture(streamStore.captureSource);
    if (!captureStarted) {
      console.warn('[StreamService] Capture failed to start');
      await HLSService.stopHLS();
      streamStore.stopStream();
      return false;
    }
    console.log('[StreamService] Capture started successfully');

    // 3. Start duration timer
    startDurationTimer();

    // 4. Start inference if enabled
    if (streamStore.inferenceEnabled) {
      InferenceService.startInference().catch((err) => {
        console.warn('Inference failed to start:', err);
        // Non-fatal — stream continues without inference
      });
    }

    streamStore.setStatus('streaming');
    return true;
  } catch (error: any) {
    streamStore.setError(`Stream failed: ${error.message}`);
    streamStore.stopStream();
    return false;
  }
}

async function startCapture(source: 'screen' | 'camera' | 'both'): Promise<boolean> {
  const streamStore = useStreamIOStreamStore.getState();

  if (source === 'screen' || source === 'both') {
    if (CaptureService.isCaptureAvailable()) {
      const started = await CaptureService.startScreenCapture();
      if (!started && source === 'screen') return false;

      // Subscribe to screen frames and route to HLS
      frameUnsubscribe = CaptureService.onFrameReceived((frameData) => {
        HLSService.writeChunk(frameData);
      });
    } else if (source === 'screen') {
      streamStore.setError('Screen capture not available on this device');
      return false;
    }
  }

  if (source === 'camera' || source === 'both') {
    const hasPermission = await CameraService.requestCameraPermission();
    if (!hasPermission) {
      console.warn('Camera permission check returned false, proceeding anyway (camera may already be active)');
    }
    CameraService.startCamera();
    // Start capturing frames from camera and uploading to server
    startCameraFrameCapture();

    // Also request mic permission for audio
    await CameraService.requestMicrophonePermission();
  }

  return true;
}

let isUploadingFrame = false;

function startCameraFrameCapture() {
  if (cameraFrameInterval) clearInterval(cameraFrameInterval);
  isUploadingFrame = false;

  // Capture a frame every 3s — skip if previous upload is still in progress
  cameraFrameInterval = setInterval(async () => {
    if (isUploadingFrame) return; // don't stack uploads
    try {
      isUploadingFrame = true;
      const base64 = await safelyTakePhoto();
      if (base64) {
        await HLSService.uploadFrame(base64);
      }
    } catch (error: any) {
      // Frame capture may fail occasionally, don't stop the stream
      console.warn('Frame capture error:', error.message);
    } finally {
      isUploadingFrame = false;
    }
  }, 3000);
}

function stopCameraFrameCapture() {
  if (cameraFrameInterval) {
    clearInterval(cameraFrameInterval);
    cameraFrameInterval = null;
  }
}

export async function stopStream(): Promise<void> {
  // Stop inference
  await InferenceService.stopInference();

  // Stop duration timer
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }

  // Unsubscribe from frame events
  if (frameUnsubscribe) {
    frameUnsubscribe();
    frameUnsubscribe = null;
  }

  // Stop all capture sources
  stopCameraFrameCapture();
  await CaptureService.stopScreenCapture();
  CameraService.stopCamera();

  // Stop HLS
  await HLSService.stopHLS();

  // Reset store state to idle
  useStreamIOStreamStore.getState().stopStream();
}

function startDurationTimer() {
  if (durationTimer) clearInterval(durationTimer);

  durationTimer = setInterval(() => {
    const store = useStreamIOStreamStore.getState();
    if (store.startedAt) {
      const elapsed = Math.floor((Date.now() - new Date(store.startedAt).getTime()) / 1000);
      store.updateDuration(elapsed);
    }
  }, 1000);
}

export function switchCaptureSource(source: 'screen' | 'camera' | 'both'): void {
  const store = useStreamIOStreamStore.getState();
  store.setCaptureSource(source);

  // If streaming, restart capture with new source
  if (store.status === 'streaming') {
    // Stop current capture
    stopCameraFrameCapture();
    CaptureService.stopScreenCapture();
    CameraService.stopCamera();
    if (frameUnsubscribe) {
      frameUnsubscribe();
      frameUnsubscribe = null;
    }

    // Start new capture
    startCapture(source);
  }
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatBitrate(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} kbps`;
  return `${bps} bps`;
}

// ─── Past Streams API ───────────────────────────────────────────────

import { StreamIOAPIConfig } from '@/constants/streamio/config';

export interface PastStream {
  sessionId: string;
  title: string;
  status: string;
  duration: number;
  segmentCount: number;
  thumbnailSignedUrl: string | null;
  aiTranscript: string[];
  estimatedCost: number;
  startedAt: string;
  stoppedAt: string | null;
}

export async function fetchPastStreams(page = 1, limit = 20): Promise<{ streams: PastStream[]; total: number }> {
  const url = `${StreamIOAPIConfig.baseURL}${StreamIOAPIConfig.endpoints.streams}?page=${page}&limit=${limit}&status=ready`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to fetch streams');
  return { streams: json.streams, total: json.pagination.total };
}

export async function fetchStreamDetail(streamId: string): Promise<PastStream> {
  const url = `${StreamIOAPIConfig.baseURL}${StreamIOAPIConfig.endpoints.streams}/${streamId}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Stream not found');
  return json.stream;
}

export async function deleteStream(streamId: string): Promise<void> {
  const url = `${StreamIOAPIConfig.baseURL}${StreamIOAPIConfig.endpoints.streams}/${streamId}`;
  const res = await fetch(url, { method: 'DELETE' });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to delete');
}

export interface StreamFrame {
  index: number;
  url: string;
}

export async function fetchStreamFrames(
  streamId: string,
  page = 1,
  limit = 50,
): Promise<{ frames: StreamFrame[]; total: number }> {
  const url = `${StreamIOAPIConfig.baseURL}${StreamIOAPIConfig.endpoints.streams}/${streamId}/frames?page=${page}&limit=${limit}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to fetch frames');
  return { frames: json.frames, total: json.pagination.total };
}

export async function renameStream(streamId: string, title: string): Promise<void> {
  const url = `${StreamIOAPIConfig.baseURL}${StreamIOAPIConfig.endpoints.streams}/${streamId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to rename');
}
