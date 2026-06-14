// HLS transcoding service — manages FFmpeg encoding pipeline on mobile
//
// Two modes:
//   1. On-device: FFmpeg transcodes locally, outputs HLS segments to cache dir
//   2. Server-side: Raw frames uploaded to backend, server does transcoding
//
// On mobile, on-device mode uses ffmpeg-kit-react-native (dev client only).
// Server-side mode works everywhere by POSTing segments to the API.

import { NativeModules } from 'react-native';
import { useStreamIOStreamStore } from '@/stores/streamio/streamStore';
import { streamIOApiClient } from '@/services/streamio/apiClient';
import { HLSConfig, HLSStatus, TranscodingMode } from '@/types/streamio';
import { StreamIOAPIConfig } from '@/constants/streamio/config';
import * as FileSystem from 'expo-file-system/legacy';
import {
  buildOverlayPayload,
  buildFFmpegOverlayFilter,
  hasOverlayContent,
  parseResolution,
} from './overlayCompositor';

let ffmpegKit: any = null;
let ffmpegLoadAttempted = false;
let activeSessionId: number | null = null;
let segmentInterval: ReturnType<typeof setInterval> | null = null;

// Lazy-load FFmpegKit — only works in dev client builds, not Expo Go
function getFFmpegKit() {
  if (ffmpegKit) return ffmpegKit;
  if (ffmpegLoadAttempted) return null;
  ffmpegLoadAttempted = true;

  // Check if the native module exists before requiring the JS wrapper
  if (!NativeModules.FFmpegKitReactNativeModule) {
    console.warn('FFmpegKit native module not found — on-device transcoding disabled (Expo Go)');
    return null;
  }

  try {
    ffmpegKit = require('ffmpeg-kit-react-native');
    return ffmpegKit;
  } catch {
    console.warn('ffmpeg-kit-react-native not available — on-device transcoding disabled');
    return null;
  }
}

function getOutputDir(): string {
  if (FileSystem.cacheDirectory) {
    return `${FileSystem.cacheDirectory}streamio-hls`;
  }
  return '/tmp/streamio-hls';
}

function resolveTranscodingMode(mode: TranscodingMode): 'onDevice' | 'serverSide' {
  if (mode === 'auto') {
    // Use on-device if FFmpegKit is available, otherwise server-side
    return getFFmpegKit() ? 'onDevice' : 'serverSide';
  }
  return mode;
}

// ─── On-Device Transcoding ──────────────────────────────────────────

export async function startOnDeviceTranscoding(config: HLSConfig): Promise<boolean> {
  const kit = await getFFmpegKit();
  if (!kit) {
    useStreamIOStreamStore.getState().setError('FFmpegKit not available — install ffmpeg-kit-react-native');
    return false;
  }

  const outputDir = getOutputDir();
  const { FFmpegKit: FK, FFmpegKitConfig } = kit;

  // Ensure output directory exists
  if (FileSystem.documentDirectory) {
    await FileSystem.makeDirectoryAsync(outputDir, { intermediates: true }).catch(() => {});
  }

  const segmentFile = `${outputDir}/segment%03d.ts`;
  const playlistFile = `${outputDir}/stream.m3u8`;

  // Build FFmpeg command — optionally includes inference overlay filters
  const dimensions = parseResolution(config.resolution);
  const overlayFilter = buildFFmpegOverlayFilter(dimensions);
  const videoFilters = overlayFilter
    ? ['-vf', overlayFilter]
    : [];

  // FFmpeg command for HLS output from pipe input
  // On mobile we receive H.264 frames from the camera/screen, so we can copy codec
  const command = [
    '-f rawvideo',
    '-pix_fmt nv12',
    `-s ${config.resolution}`,
    '-r 30',
    '-i pipe:0',
    ...videoFilters,
    '-c:v libx264',
    '-preset ultrafast',
    '-tune zerolatency',
    `-g ${config.segmentDuration * 30}`,
    '-sc_threshold 0',
    `-b:v ${config.bitrate}`,
    '-f hls',
    `-hls_time ${config.segmentDuration}`,
    `-hls_list_size ${config.playlistSize}`,
    '-hls_flags delete_segments+append_list',
    `-hls_segment_filename ${segmentFile}`,
    playlistFile,
  ].join(' ');

  try {
    const session = await FK.executeAsync(command);
    activeSessionId = session.getSessionId();

    useStreamIOStreamStore.getState().setStatus('streaming');
    useStreamIOStreamStore.getState().setStreamUrl(playlistFile);

    // Monitor segment count
    startSegmentMonitor(outputDir);

    return true;
  } catch (error: any) {
    useStreamIOStreamStore.getState().setError(`FFmpeg error: ${error.message}`);
    return false;
  }
}

function startSegmentMonitor(outputDir: string) {
  if (segmentInterval) clearInterval(segmentInterval);

  segmentInterval = setInterval(async () => {
    if (!FileSystem.cacheDirectory) return;

    try {
      const files = await FileSystem.readDirectoryAsync(outputDir);
      const segments = files.filter((f: string) => f.endsWith('.ts'));
      const store = useStreamIOStreamStore.getState();
      if (segments.length !== store.segmentCount) {
        store.incrementSegment();
      }
    } catch {
      // Directory may not exist yet
    }
  }, 2000);
}

export async function stopOnDeviceTranscoding(): Promise<void> {
  const kit = await getFFmpegKit();
  if (kit && activeSessionId != null) {
    try {
      await kit.FFmpegKit.cancel(activeSessionId);
    } catch {
      // Ignore cancel errors
    }
    activeSessionId = null;
  }

  if (segmentInterval) {
    clearInterval(segmentInterval);
    segmentInterval = null;
  }
}

// ─── Server-Side Transcoding ────────────────────────────────────────

let uploadQueue: ArrayBuffer[] = [];
let isUploading = false;
let serverStreamId: string | null = null;

export async function startServerSideTranscoding(config: HLSConfig): Promise<boolean> {
  try {
    console.log('[HLS] Starting server-side transcoding, baseURL:', StreamIOAPIConfig.baseURL);

    // Create a conversation first, then start live-screen session
    let conversationId: string;
    try {
      const convResponse = await streamIOApiClient.post<{ data?: { id?: string } }>(
        StreamIOAPIConfig.endpoints.conversations,
        { title: `Stream ${new Date().toLocaleString()}`, type: 'screenshare' },
      );
      conversationId = convResponse?.data?.id || `conv_${Date.now()}`;
      console.log('[HLS] Conversation created:', conversationId);
    } catch (convErr: any) {
      console.warn('[HLS] Conversation creation failed (using fallback):', convErr.message);
      conversationId = `conv_${Date.now()}`;
    }

    // Start live-screen session on backend
    serverStreamId = await createLiveScreenSession(conversationId);
    if (!serverStreamId) {
      throw new Error('Failed to obtain server stream ID');
    }

    console.log('[HLS] Server stream ID:', serverStreamId);
    useStreamIOStreamStore.getState().setStatus('streaming');

    // Construct the stream URL from the session
    const streamUrl = `${StreamIOAPIConfig.baseURL}${StreamIOAPIConfig.endpoints.liveScreen}/${serverStreamId}`;
    useStreamIOStreamStore.getState().setStreamUrl(streamUrl);
    useStreamIOStreamStore.getState().setPublicUrl(streamUrl);

    return true;
  } catch (error: any) {
    console.warn('[HLS] Server-side transcoding error:', error.message, error.statusCode, error.data);
    useStreamIOStreamStore.getState().setError(`Stream error: ${error.message}`);
    return false;
  }
}

/** Create a live-screen session on the backend, returns sessionId or null. */
async function createLiveScreenSession(conversationId: string): Promise<string | null> {
  const response = await streamIOApiClient.post<{
    data?: { sessionId?: string };
    sessionId?: string;
  }>(
    StreamIOAPIConfig.endpoints.liveScreenStart,
    {
      conversationId,
      settings: {
        quality: 0.8,
        frameRate: 30,
      },
    },
  );
  return response?.data?.sessionId || response?.sessionId || null;
}

/** Re-create a live-screen session (e.g. after backend restart) and update serverStreamId. */
async function recoverSession(): Promise<boolean> {
  try {
    console.log('[HLS] Attempting session recovery...');
    const conversationId = `conv_recovery_${Date.now()}`;
    const newId = await createLiveScreenSession(conversationId);
    if (newId) {
      serverStreamId = newId;
      console.log('[HLS] Session recovered, new ID:', newId);
      return true;
    }
  } catch (err: any) {
    console.warn('[HLS] Session recovery failed:', err.message);
  }
  return false;
}

export async function uploadChunk(data: ArrayBuffer): Promise<void> {
  if (!serverStreamId) return;

  uploadQueue.push(data);
  if (isUploading) return;

  isUploading = true;
  while (uploadQueue.length > 0) {
    const chunk = uploadQueue.shift()!;

    // Include inference overlay data if available
    const inferenceEnabled = useStreamIOStreamStore.getState().inferenceEnabled;
    const overlay = inferenceEnabled && hasOverlayContent()
      ? buildOverlayPayload()
      : undefined;

    try {
      const chunkT0 = Date.now();
      await streamIOApiClient.post(
        `${StreamIOAPIConfig.endpoints.liveScreen}/${serverStreamId}/frame`,
        {
          imageData: `data:video/mp2t;base64,${Buffer.from(chunk).toString('base64')}`,
          metadata: { resolution: { width: 1280, height: 720 }, quality: 0.8 },
          overlay,
        },
      );
      const chunkElapsed = (Date.now() - chunkT0) / 1000 || 0.001;
      useStreamIOStreamStore.getState().setThroughputBps(chunk.byteLength / chunkElapsed);
      useStreamIOStreamStore.getState().incrementSegment();
    } catch (error: any) {
      if (error.statusCode === 404) {
        console.warn('[HLS] Chunk upload 404 — recovering session...');
        const recovered = await recoverSession();
        if (!recovered) {
          console.error('Chunk upload failed (session unrecoverable):', error.message);
          break;
        }
        // Re-queue the chunk for retry
        uploadQueue.unshift(chunk);
      } else {
        console.error('Chunk upload failed:', error.message);
      }
    }
  }
  isUploading = false;
}

export function getServerStreamId(): string | null {
  return serverStreamId;
}

export async function uploadFrame(base64ImageData: string): Promise<void> {
  if (!serverStreamId) return;

  const endpoint = `${StreamIOAPIConfig.endpoints.liveScreen}/${serverStreamId}/frame`;
  console.log('Uploading frame to:', endpoint, 'base64 length:', base64ImageData.length);

  // Include inference overlay data if available
  const inferenceEnabled = useStreamIOStreamStore.getState().inferenceEnabled;
  const overlay = inferenceEnabled && hasOverlayContent()
    ? buildOverlayPayload()
    : undefined;

  try {
    const byteLength = base64ImageData.length * 0.75; // approximate decoded size
    const t0 = Date.now();
    await streamIOApiClient.post(
      endpoint,
      {
        imageData: `data:image/jpeg;base64,${base64ImageData}`,
        metadata: { resolution: { width: 1280, height: 720 }, quality: 0.8 },
        overlay,
      },
      undefined,
      StreamIOAPIConfig.timeouts.upload, // 120s for large frames over tunnel
    );
    const elapsed = (Date.now() - t0) / 1000 || 0.001;
    useStreamIOStreamStore.getState().setThroughputBps(byteLength / elapsed);
    useStreamIOStreamStore.getState().incrementSegment();
  } catch (error: any) {
    // If session not found (e.g. backend restarted), attempt recovery
    if (error.statusCode === 404) {
      console.warn('[HLS] Session 404 — attempting recovery...');
      const recovered = await recoverSession();
      if (recovered) {
        // Retry with new session
        try {
          await streamIOApiClient.post(
            `${StreamIOAPIConfig.endpoints.liveScreen}/${serverStreamId}/frame`,
            {
              imageData: `data:image/jpeg;base64,${base64ImageData}`,
              metadata: { resolution: { width: 1280, height: 720 }, quality: 0.8 },
              overlay,
            },
            undefined,
            StreamIOAPIConfig.timeouts.upload,
          );
          useStreamIOStreamStore.getState().incrementSegment();
          return;
        } catch (retryErr: any) {
          console.error('Frame upload failed after recovery:', retryErr.message);
        }
      }
    }
    console.error('Frame upload failed:', error.message);
  }
}

export async function stopServerSideTranscoding(): Promise<void> {
  if (serverStreamId) {
    try {
      await streamIOApiClient.post(`${StreamIOAPIConfig.endpoints.liveScreen}/${serverStreamId}/stop`, {});
    } catch {
      // Best effort cleanup
    }
    serverStreamId = null;
  }
  uploadQueue = [];
  isUploading = false;
}

// ─── Unified Interface ──────────────────────────────────────────────

export async function startHLS(config: HLSConfig): Promise<boolean> {
  const mode = resolveTranscodingMode(config.transcodingMode);
  useStreamIOStreamStore.getState().setStatus('starting');

  if (mode === 'onDevice') {
    return startOnDeviceTranscoding(config);
  } else {
    return startServerSideTranscoding(config);
  }
}

export async function stopHLS(): Promise<void> {
  const store = useStreamIOStreamStore.getState();
  store.setStatus('stopping');

  await Promise.all([stopOnDeviceTranscoding(), stopServerSideTranscoding()]);

  store.stopStream();
}

export async function writeChunk(data: ArrayBuffer): Promise<void> {
  const store = useStreamIOStreamStore.getState();
  const mode = resolveTranscodingMode(store.config.transcodingMode);

  if (mode === 'serverSide') {
    await uploadChunk(data);
  }
  // On-device mode: FFmpeg reads from pipe, chunks are written via native bridge
}

export function getHLSStatus() {
  const store = useStreamIOStreamStore.getState();
  return {
    status: store.status,
    segmentCount: store.segmentCount,
    streamUrl: store.streamUrl,
    publicUrl: store.publicUrl,
    startedAt: store.startedAt,
    duration: store.duration,
  };
}
