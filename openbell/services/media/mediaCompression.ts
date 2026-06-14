import { getInfoAsync } from "expo-file-system/legacy";

export type CompressionQuality = "low" | "medium" | "high" | "original";

const QUALITY_MAP: Record<CompressionQuality, number> = {
  low: 0.3,
  medium: 0.6,
  high: 0.8,
  original: 1.0,
};

/**
 * Compress an image before upload.
 * For MVP, checks file size and returns as-is if below threshold.
 * Full compression would use expo-image-manipulator.
 */
export async function compressImage(
  uri: string,
  quality: CompressionQuality = "medium"
): Promise<{ uri: string; size: number }> {
  const info = await getInfoAsync(uri);
  const fileSize = info.exists && "size" in info ? (info.size as number) : 0;

  // Skip compression for small files or original quality
  const threshold = quality === "low" ? 200_000 : quality === "medium" ? 500_000 : 1_000_000;
  if (fileSize < threshold || quality === "original") {
    return { uri, size: fileSize };
  }

  // Architecture placeholder for expo-image-manipulator integration
  return { uri, size: fileSize };
}

/** Estimate compressed file size for UI preview. */
export function estimateCompressedSize(originalSize: number, quality: CompressionQuality): number {
  return Math.round(originalSize * QUALITY_MAP[quality]);
}

/** Check if a file needs compression based on size threshold. */
export function needsCompression(sizeBytes: number, quality: CompressionQuality): boolean {
  if (quality === "original") return false;
  const threshold = quality === "low" ? 200_000 : quality === "medium" ? 500_000 : 1_000_000;
  return sizeBytes > threshold;
}
