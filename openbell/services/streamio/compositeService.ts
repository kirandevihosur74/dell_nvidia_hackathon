// Composite service — manages multi-source stream composition
//
// On mobile, compositing is simpler than desktop:
//   - Screen + Camera PiP (picture-in-picture overlay)
//   - Individual per-stream endpoints (screen-only, camera-only)
//
// The actual compositing happens either:
//   1. Server-side: Both streams uploaded separately, server composites
//   2. On-device: FFmpeg overlay filter merges screen + camera

import { useStreamIOStreamStore } from '@/stores/streamio/streamStore';
import { streamIOApiClient } from '@/services/streamio/apiClient';
import { StreamIOAPIConfig } from '@/constants/streamio/config';
import { buildFFmpegOverlayFilter, parseResolution } from './overlayCompositor';

export type CompositeLayout = 'pip-bottom-right' | 'pip-bottom-left' | 'pip-top-right' | 'pip-top-left' | 'side-by-side' | 'full-screen';

export interface StreamSource {
  id: string;
  type: 'screen' | 'camera';
  label: string;
  isActive: boolean;
  hlsUrl: string | null;
}

export interface CompositeConfig {
  layout: CompositeLayout;
  pipSize: 'small' | 'medium' | 'large'; // 1/6, 1/4, 1/3 of screen
  pipSource: 'camera' | 'screen'; // which source goes in PiP
  primarySource: 'screen' | 'camera'; // which source is fullscreen
}

const DEFAULT_COMPOSITE_CONFIG: CompositeConfig = {
  layout: 'pip-bottom-right',
  pipSize: 'medium',
  pipSource: 'camera',
  primarySource: 'screen',
};

let compositeConfig: CompositeConfig = { ...DEFAULT_COMPOSITE_CONFIG };
let activeSources: Map<string, StreamSource> = new Map();

export function getCompositeConfig(): CompositeConfig {
  return { ...compositeConfig };
}

export function setCompositeConfig(config: Partial<CompositeConfig>): void {
  compositeConfig = { ...compositeConfig, ...config };
}

export function resetCompositeConfig(): void {
  compositeConfig = { ...DEFAULT_COMPOSITE_CONFIG };
}

// Register a stream source with the server for per-stream HLS
export async function registerSource(
  streamId: string,
  type: 'screen' | 'camera',
  label: string,
): Promise<StreamSource> {
  const source: StreamSource = {
    id: `${streamId}_${type}`,
    type,
    label,
    isActive: true,
    hlsUrl: null,
  };

  try {
    const response = await streamIOApiClient.post<{ sourceId: string; hlsUrl: string }>(
      `${StreamIOAPIConfig.endpoints.streams}/${streamId}/sources`,
      { type, label },
    );
    source.id = response.sourceId;
    source.hlsUrl = response.hlsUrl;
  } catch {
    // Server registration failed — source still exists locally
  }

  activeSources.set(source.id, source);
  return source;
}

export async function unregisterSource(sourceId: string): Promise<void> {
  const source = activeSources.get(sourceId);
  if (!source) return;

  activeSources.delete(sourceId);

  try {
    await streamIOApiClient.delete(`${StreamIOAPIConfig.endpoints.streams}/sources/${sourceId}`);
  } catch {
    // Best effort
  }
}

export function getActiveSources(): StreamSource[] {
  return Array.from(activeSources.values());
}

export function clearAllSources(): void {
  activeSources.clear();
}

// Get FFmpeg filter for on-device PiP compositing
export function getPipOverlayFilter(config: CompositeConfig): string {
  const pipSizeMap = { small: 6, medium: 4, large: 3 };
  const divisor = pipSizeMap[config.pipSize];

  const positionMap: Record<string, string> = {
    'pip-bottom-right': `main_w-overlay_w-20:main_h-overlay_h-20`,
    'pip-bottom-left': `20:main_h-overlay_h-20`,
    'pip-top-right': `main_w-overlay_w-20:20`,
    'pip-top-left': `20:20`,
  };

  if (config.layout === 'side-by-side') {
    return `[0:v]scale=iw/2:ih[left];[1:v]scale=iw/2:ih[right];[left][right]hstack`;
  }

  if (config.layout === 'full-screen') {
    return ''; // No overlay, just one source
  }

  const position = positionMap[config.layout] || positionMap['pip-bottom-right'];
  return `[1:v]scale=iw/${divisor}:ih/${divisor}[pip];[0:v][pip]overlay=${position}`;
}

// Get FFmpeg filter for PiP + inference overlay combined
export function getCompositeFilterWithInference(
  config: CompositeConfig,
  resolution: string,
): string {
  const pipFilter = getPipOverlayFilter(config);
  const dimensions = parseResolution(resolution);
  const inferenceFilter = buildFFmpegOverlayFilter(dimensions);

  if (!inferenceFilter) return pipFilter;
  if (!pipFilter) return inferenceFilter;
  return `${pipFilter},${inferenceFilter}`;
}

// Grid layout for preview thumbnails (matches Electron's gridLayout)
export function gridLayout(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  if (count <= 9) return { cols: 3, rows: 3 };
  const cols = Math.ceil(Math.sqrt(count));
  return { cols, rows: Math.ceil(count / cols) };
}
