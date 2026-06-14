import { create } from 'zustand';
import { HLSStatus, TunnelStatus, TranscodingMode, StreamInfo, HLSConfig } from '@/types/streamio';
import { StreamIODefaults } from '@/constants/streamio/config';

interface StreamState {
  // Stream status
  status: HLSStatus;
  tunnelStatus: TunnelStatus;
  streamUrl: string | null;
  publicUrl: string | null;

  // Active stream info
  activeStreamId: string | null;
  segmentCount: number;
  startedAt: string | null;
  viewerCount: number;
  duration: number; // seconds

  // Configuration
  config: HLSConfig;

  // Capture source state
  captureSource: 'screen' | 'camera' | 'both';
  isCameraActive: boolean;
  isScreenCaptureActive: boolean;
  selectedCameraId: string | null;
  cameraPosition: 'front' | 'back';

  // Preview
  isPreviewActive: boolean;
  previewUri: string | null;

  // Inference
  inferenceEnabled: boolean;
  activePipelineId: string | null;

  // Dynamic metrics
  actualResolution: string | null; // e.g. "1920x1080" from camera
  throughputBps: number; // measured bytes/sec from frame uploads

  // Error
  lastError: string | null;

  // Actions
  setStatus: (status: HLSStatus) => void;
  setTunnelStatus: (status: TunnelStatus) => void;
  setStreamUrl: (url: string | null) => void;
  setPublicUrl: (url: string | null) => void;
  setConfig: (config: Partial<HLSConfig>) => void;
  setCaptureSource: (source: 'screen' | 'camera' | 'both') => void;
  setCameraActive: (active: boolean) => void;
  setScreenCaptureActive: (active: boolean) => void;
  setCameraPosition: (position: 'front' | 'back') => void;
  setPreview: (active: boolean, uri?: string | null) => void;
  incrementSegment: () => void;
  updateDuration: (seconds: number) => void;
  setViewerCount: (count: number) => void;
  setError: (error: string | null) => void;
  setActualResolution: (resolution: string) => void;
  setThroughputBps: (bps: number) => void;
  setInferenceEnabled: (enabled: boolean) => void;
  setActivePipelineId: (id: string | null) => void;
  startStream: (streamId: string) => void;
  stopStream: () => void;
  reset: () => void;
}

const DEFAULT_CONFIG: HLSConfig = {
  segmentDuration: StreamIODefaults.segmentDuration,
  playlistSize: StreamIODefaults.playlistSize,
  resolution: StreamIODefaults.resolution,
  bitrate: StreamIODefaults.bitrate,
  transcodingMode: 'auto',
};

export const useStreamIOStreamStore = create<StreamState>()((set) => ({
  status: 'idle',
  tunnelStatus: 'disconnected',
  streamUrl: null,
  publicUrl: null,
  activeStreamId: null,
  segmentCount: 0,
  startedAt: null,
  viewerCount: 0,
  duration: 0,
  config: { ...DEFAULT_CONFIG },
  captureSource: 'camera',
  isCameraActive: false,
  isScreenCaptureActive: false,
  selectedCameraId: null,
  cameraPosition: 'front',
  isPreviewActive: false,
  previewUri: null,
  actualResolution: null,
  throughputBps: 0,
  inferenceEnabled: true,
  activePipelineId: null,
  lastError: null,

  setStatus: (status) => set({ status }),
  setTunnelStatus: (tunnelStatus) => set({ tunnelStatus }),
  setStreamUrl: (streamUrl) => set({ streamUrl }),
  setPublicUrl: (publicUrl) => set({ publicUrl }),

  setConfig: (partial) =>
    set((state) => ({ config: { ...state.config, ...partial } })),

  setCaptureSource: (captureSource) => set({ captureSource }),
  setCameraActive: (isCameraActive) => set({ isCameraActive }),
  setScreenCaptureActive: (isScreenCaptureActive) => set({ isScreenCaptureActive }),
  setCameraPosition: (cameraPosition) => set({ cameraPosition }),

  setPreview: (active, uri) =>
    set({ isPreviewActive: active, previewUri: uri ?? null }),

  incrementSegment: () =>
    set((state) => ({ segmentCount: state.segmentCount + 1 })),

  updateDuration: (seconds) => set({ duration: seconds }),
  setViewerCount: (viewerCount) => set({ viewerCount }),
  setError: (lastError) => set({ lastError }),
  setActualResolution: (actualResolution) => set({ actualResolution }),
  setThroughputBps: (throughputBps) => set({ throughputBps }),
  setInferenceEnabled: (inferenceEnabled) => set({ inferenceEnabled }),
  setActivePipelineId: (activePipelineId) => set({ activePipelineId }),

  startStream: (streamId) =>
    set({
      activeStreamId: streamId,
      status: 'starting',
      segmentCount: 0,
      startedAt: new Date().toISOString(),
      duration: 0,
      lastError: null,
    }),

  stopStream: () =>
    set({
      status: 'idle',
      activeStreamId: null,
      streamUrl: null,
      publicUrl: null,
      segmentCount: 0,
      startedAt: null,
      duration: 0,
      viewerCount: 0,
      isPreviewActive: false,
      previewUri: null,
      isCameraActive: false,
      isScreenCaptureActive: false,
      tunnelStatus: 'disconnected',
      actualResolution: null,
      throughputBps: 0,
      inferenceEnabled: false,
      activePipelineId: null,
    }),

  reset: () =>
    set({
      status: 'idle',
      tunnelStatus: 'disconnected',
      streamUrl: null,
      publicUrl: null,
      activeStreamId: null,
      segmentCount: 0,
      startedAt: null,
      viewerCount: 0,
      duration: 0,
      config: { ...DEFAULT_CONFIG },
      captureSource: 'camera',
      isCameraActive: false,
      isScreenCaptureActive: false,
      selectedCameraId: null,
      cameraPosition: 'front',
      isPreviewActive: false,
      inferenceEnabled: false,
      activePipelineId: null,
      previewUri: null,
      lastError: null,
    }),
}));
