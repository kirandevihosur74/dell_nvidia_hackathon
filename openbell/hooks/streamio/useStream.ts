import { useEffect, useRef } from 'react';
import { useStreamIOStreamStore } from '@/stores/streamio/streamStore';
import * as StreamService from '@/services/streamio/streamService';

export function useStream() {
  const status = useStreamIOStreamStore((s) => s.status);
  const tunnelStatus = useStreamIOStreamStore((s) => s.tunnelStatus);
  const streamUrl = useStreamIOStreamStore((s) => s.streamUrl);
  const publicUrl = useStreamIOStreamStore((s) => s.publicUrl);
  const segmentCount = useStreamIOStreamStore((s) => s.segmentCount);
  const duration = useStreamIOStreamStore((s) => s.duration);
  const viewerCount = useStreamIOStreamStore((s) => s.viewerCount);
  const lastError = useStreamIOStreamStore((s) => s.lastError);
  const config = useStreamIOStreamStore((s) => s.config);
  const captureSource = useStreamIOStreamStore((s) => s.captureSource);
  const isCameraActive = useStreamIOStreamStore((s) => s.isCameraActive);
  const isScreenCaptureActive = useStreamIOStreamStore((s) => s.isScreenCaptureActive);
  const cameraPosition = useStreamIOStreamStore((s) => s.cameraPosition);
  const actualResolution = useStreamIOStreamStore((s) => s.actualResolution);
  const throughputBps = useStreamIOStreamStore((s) => s.throughputBps);

  const isStreaming = status === 'streaming';
  const isStarting = status === 'starting';
  const isStopping = status === 'stopping';
  const isBusy = isStarting || isStopping;

  const formattedDuration = StreamService.formatDuration(duration);
  const formattedBitrate = StreamService.formatBitrate(config.bitrate);

  return {
    // State
    status,
    tunnelStatus,
    streamUrl,
    publicUrl,
    segmentCount,
    duration,
    formattedDuration,
    viewerCount,
    lastError,
    config,
    captureSource,
    isCameraActive,
    isScreenCaptureActive,
    cameraPosition,
    actualResolution,
    throughputBps,

    // Derived
    isStreaming,
    isStarting,
    isStopping,
    isBusy,
    formattedBitrate,

    // Actions
    startStream: StreamService.startStream,
    stopStream: StreamService.stopStream,
    switchCaptureSource: StreamService.switchCaptureSource,
    setConfig: useStreamIOStreamStore.getState().setConfig,
    setCaptureSource: useStreamIOStreamStore.getState().setCaptureSource,
    setCameraPosition: useStreamIOStreamStore.getState().setCameraPosition,
    setError: useStreamIOStreamStore.getState().setError,
  };
}
