import {
  cacheDirectory,
  getInfoAsync,
  readAsStringAsync,
  makeDirectoryAsync,
  deleteAsync,
  createDownloadResumable,
  EncodingType,
} from "expo-file-system/legacy";
import { gatewayClient } from "@/services/gateway";
import type { MediaAttachment } from "@/types/cards";

const MEDIA_DIR = `${cacheDirectory}openclaw-media/`;

type ProgressCallback = (progress: number) => void;

/** Ensure media cache directory exists. */
async function ensureMediaDir(): Promise<void> {
  const dirInfo = await getInfoAsync(MEDIA_DIR);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
  }
}

/** Upload a media file to the Gateway. Returns the remote URI. */
export async function uploadMedia(
  attachment: MediaAttachment,
  onProgress?: ProgressCallback
): Promise<string> {
  // Read the file as base64
  const base64 = await readAsStringAsync(attachment.uri, {
    encoding: EncodingType.Base64,
  });

  // Send via gateway protocol as a media message
  const sent = gatewayClient.send({
    type: "chat",
    id: `media_${Date.now()}`,
    payload: {
      type: "media",
      mediaType: attachment.type,
      mimeType: attachment.mimeType,
      fileName: attachment.fileName || `file_${Date.now()}`,
      data: base64,
      size: attachment.size,
    },
  });

  if (!sent) {
    throw new Error("Failed to send media — Gateway not connected");
  }

  onProgress?.(100);
  return attachment.uri;
}

/** Download media from a URL and cache it locally. */
export async function downloadMedia(
  remoteUrl: string,
  fileName: string,
  onProgress?: ProgressCallback
): Promise<string> {
  await ensureMediaDir();

  const localPath = `${MEDIA_DIR}${fileName}`;
  const fileInfo = await getInfoAsync(localPath);

  // Return cached version if available
  if (fileInfo.exists) {
    onProgress?.(100);
    return localPath;
  }

  const downloadResumable = createDownloadResumable(
    remoteUrl,
    localPath,
    {},
    (downloadProgress) => {
      const progress =
        downloadProgress.totalBytesExpectedToWrite > 0
          ? Math.round(
              (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100
            )
          : 0;
      onProgress?.(progress);
    }
  );

  const result = await downloadResumable.downloadAsync();
  if (!result?.uri) {
    throw new Error("Download failed");
  }

  return result.uri;
}

/** Get the local cache path for a media file. */
export function getMediaCachePath(fileName: string): string {
  return `${MEDIA_DIR}${fileName}`;
}

/** Check if a media file is cached locally. */
export async function isMediaCached(fileName: string): Promise<boolean> {
  const path = `${MEDIA_DIR}${fileName}`;
  const info = await getInfoAsync(path);
  return info.exists;
}

/** Delete a cached media file. */
export async function deleteMediaCache(fileName: string): Promise<void> {
  const path = `${MEDIA_DIR}${fileName}`;
  const info = await getInfoAsync(path);
  if (info.exists) {
    await deleteAsync(path);
  }
}

/** Format file size for display. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
