import { cacheDirectory, deleteAsync, makeDirectoryAsync } from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MEDIA_DIR = `${cacheDirectory}openclaw-media/`;
const CACHE_INDEX_KEY = "openclaw_media_cache_index";
const DEFAULT_MAX_SIZE = 500 * 1024 * 1024; // 500MB

interface CacheEntry {
  fileName: string;
  size: number;
  lastAccessed: number;
}

interface CacheIndex {
  entries: CacheEntry[];
  totalSize: number;
}

async function loadIndex(): Promise<CacheIndex> {
  try {
    const data = await AsyncStorage.getItem(CACHE_INDEX_KEY);
    return data ? JSON.parse(data) : { entries: [], totalSize: 0 };
  } catch {
    return { entries: [], totalSize: 0 };
  }
}

async function saveIndex(index: CacheIndex): Promise<void> {
  await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
}

/** Record a file in the cache index. */
export async function trackFile(fileName: string, size: number): Promise<void> {
  const index = await loadIndex();

  const existing = index.entries.findIndex((e) => e.fileName === fileName);
  if (existing >= 0) {
    index.entries[existing].lastAccessed = Date.now();
    index.entries[existing].size = size;
  } else {
    index.entries.push({ fileName, size, lastAccessed: Date.now() });
    index.totalSize += size;
  }

  await saveIndex(index);
  await evictIfNeeded(index);
}

/** Mark a file as recently accessed (moves to front of LRU). */
export async function touchFile(fileName: string): Promise<void> {
  const index = await loadIndex();
  const entry = index.entries.find((e) => e.fileName === fileName);
  if (entry) {
    entry.lastAccessed = Date.now();
    await saveIndex(index);
  }
}

/** Evict least recently used files if cache exceeds max size. */
async function evictIfNeeded(index: CacheIndex, maxSize: number = DEFAULT_MAX_SIZE): Promise<void> {
  if (index.totalSize <= maxSize) return;

  index.entries.sort((a, b) => a.lastAccessed - b.lastAccessed);

  while (index.totalSize > maxSize && index.entries.length > 0) {
    const oldest = index.entries.shift();
    if (oldest) {
      index.totalSize -= oldest.size;
      const path = `${MEDIA_DIR}${oldest.fileName}`;
      try {
        await deleteAsync(path, { idempotent: true });
      } catch {
        // ignore
      }
    }
  }

  await saveIndex(index);
}

/** Get total cache size in bytes. */
export async function getCacheSize(): Promise<number> {
  const index = await loadIndex();
  return index.totalSize;
}

/** Get number of cached files. */
export async function getCacheCount(): Promise<number> {
  const index = await loadIndex();
  return index.entries.length;
}

/** Clear the entire media cache. */
export async function clearMediaCache(): Promise<void> {
  try {
    await deleteAsync(MEDIA_DIR, { idempotent: true });
    await makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
  } catch {
    // ignore
  }
  await saveIndex({ entries: [], totalSize: 0 });
}
