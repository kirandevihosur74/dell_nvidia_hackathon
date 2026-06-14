// Overlay compositor — generates burn-in data for the HLS stream
//
// Two modes:
//   1. Server-side: Serializes annotations + chat into a JSON payload
//      that accompanies each frame upload. Server renders the overlay
//      onto the video frame before HLS encoding.
//
//   2. On-device: Generates FFmpeg drawbox + drawtext filter strings
//      that burn annotations directly into the FFmpeg encoding pipeline.
//
// This service reads from inferenceStore and produces overlay data
// that hlsService consumes.

import { useStreamIOInferenceStore } from '@/stores/streamio/inferenceStore';
import { Annotation, AnnotationFrame, InferenceChatMessage } from '@/types/streamio/inference';

// ─── Server-Side Overlay Payload ─────────────────────────────────────

export interface OverlayPayload {
  annotations: OverlayAnnotation[];
  chatMessages: OverlayChatMessage[];
  timestamp: number;
}

export interface OverlayAnnotation {
  x: number;       // normalized 0-1
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
  color: string;
  agentId: string;
}

export interface OverlayChatMessage {
  agentName: string;
  agentColor: string;
  content: string;
  isStreaming: boolean;
}

const MAX_OVERLAY_CHAT_MESSAGES = 5;

/**
 * Build the overlay payload from current inference state.
 * Sent alongside frame uploads for server-side compositing.
 */
export function buildOverlayPayload(): OverlayPayload {
  const store = useStreamIOInferenceStore.getState();

  // Collect visible annotations
  const annotations: OverlayAnnotation[] = [];
  for (const [agentId, frame] of Object.entries(store.annotations)) {
    const toggle = store.viewerToggles[agentId];
    if (toggle && !toggle.annotationsVisible) continue;

    for (const ann of frame.annotations) {
      annotations.push({
        x: ann.x,
        y: ann.y,
        width: ann.width,
        height: ann.height,
        label: ann.label,
        confidence: ann.confidence,
        color: ann.color,
        agentId,
      });
    }
  }

  // Collect visible chat messages (last N)
  const chatMessages: OverlayChatMessage[] = store.chatMessages
    .filter((msg) => {
      const toggle = store.viewerToggles[msg.agentId];
      return !toggle || toggle.overlayVisible;
    })
    .slice(-MAX_OVERLAY_CHAT_MESSAGES)
    .map((msg) => ({
      agentName: msg.agentName,
      agentColor: msg.agentColor,
      content: msg.content,
      isStreaming: msg.isStreaming,
    }));

  return {
    annotations,
    chatMessages,
    timestamp: Date.now(),
  };
}

/**
 * Check if there is any overlay content to burn in.
 */
export function hasOverlayContent(): boolean {
  const store = useStreamIOInferenceStore.getState();
  const hasAnnotations = Object.keys(store.annotations).length > 0;
  const hasChat = store.chatMessages.length > 0;
  return hasAnnotations || hasChat;
}

// ─── On-Device FFmpeg Filter Generation ──────────────────────────────

/**
 * Pixel dimensions for the output video.
 * Used to convert normalized coords to pixel positions for FFmpeg filters.
 */
interface FrameDimensions {
  width: number;
  height: number;
}

/**
 * Generate FFmpeg drawbox + drawtext filter string from current annotations.
 * These filters are appended to the existing encoding pipeline.
 *
 * Example output:
 *   drawbox=x=100:y=200:w=300:h=150:color=#10B981@0.8:t=2,
 *   drawtext=text='Laptop 94%':x=100:y=178:fontsize=14:fontcolor=white:
 *   box=1:boxcolor=#10B981@0.8:boxborderw=4
 */
export function buildFFmpegOverlayFilter(dimensions: FrameDimensions): string {
  const store = useStreamIOInferenceStore.getState();
  const filters: string[] = [];

  // 1. Annotation bounding boxes + labels
  for (const [agentId, frame] of Object.entries(store.annotations)) {
    const toggle = store.viewerToggles[agentId];
    if (toggle && !toggle.annotationsVisible) continue;

    for (const ann of frame.annotations) {
      const px = Math.round(ann.x * dimensions.width);
      const py = Math.round(ann.y * dimensions.height);
      const pw = Math.round(ann.width * dimensions.width);
      const ph = Math.round(ann.height * dimensions.height);
      const hexColor = ann.color.replace('#', '');
      const confidencePct = Math.round(ann.confidence * 100);

      // Draw bounding box
      filters.push(
        `drawbox=x=${px}:y=${py}:w=${pw}:h=${ph}:color=0x${hexColor}@0.8:t=2`,
      );

      // Draw label above box
      const labelText = escapeFFmpegText(`${ann.label} ${confidencePct}%`);
      const labelY = Math.max(py - 22, 2);
      filters.push(
        `drawtext=text='${labelText}':x=${px}:y=${labelY}:fontsize=14:fontcolor=white:box=1:boxcolor=0x${hexColor}@0.8:boxborderw=4`,
      );
    }
  }

  // 2. Chat overlay (bottom of frame)
  const chatMessages = store.chatMessages
    .filter((msg) => {
      const toggle = store.viewerToggles[msg.agentId];
      return !toggle || toggle.overlayVisible;
    })
    .slice(-MAX_OVERLAY_CHAT_MESSAGES);

  if (chatMessages.length > 0) {
    // Semi-transparent chat background bar
    const chatBarHeight = chatMessages.length * 20 + 12;
    const chatBarY = dimensions.height - chatBarHeight;
    filters.push(
      `drawbox=x=0:y=${chatBarY}:w=${dimensions.width}:h=${chatBarHeight}:color=black@0.6:t=fill`,
    );

    // Draw each chat message
    chatMessages.forEach((msg, i) => {
      const text = escapeFFmpegText(`${msg.agentName}: ${msg.content}`);
      const msgY = chatBarY + 6 + i * 20;
      const hexColor = msg.agentColor.replace('#', '');

      filters.push(
        `drawtext=text='${text}':x=10:y=${msgY}:fontsize=12:fontcolor=0x${hexColor}`,
      );
    });
  }

  return filters.join(',');
}

/**
 * Build a complete FFmpeg filter chain that combines existing filters
 * (e.g., PiP overlay) with inference annotation filters.
 */
export function mergeWithExistingFilter(
  existingFilter: string,
  dimensions: FrameDimensions,
): string {
  const overlayFilter = buildFFmpegOverlayFilter(dimensions);
  if (!overlayFilter) return existingFilter;
  if (!existingFilter) return overlayFilter;
  return `${existingFilter},${overlayFilter}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Escape special characters for FFmpeg drawtext filter.
 */
function escapeFFmpegText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/%/g, '%%')
    .replace(/\n/g, ' ');
}

/**
 * Parse resolution string (e.g., "1280x720") into dimensions.
 */
export function parseResolution(resolution: string): FrameDimensions {
  const parts = resolution.split('x');
  return {
    width: parseInt(parts[0], 10) || 1280,
    height: parseInt(parts[1], 10) || 720,
  };
}
