// StreamIO offline handling — monitors backend connectivity and caches data
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { StreamIOAPIConfig } from '@/constants/streamio/config';

const STORAGE_KEYS = {
  pastStreams: 'streamio:cached_past_streams',
  offlineQueue: 'streamio:offline_queue',
  lastConnected: 'streamio:last_connected',
};

let _isBackendReachable = false;
let _checkInterval: ReturnType<typeof setInterval> | null = null;

export function isStreamIOOnline(): boolean {
  return _isBackendReachable;
}

export async function checkStreamIOBackend(): Promise<boolean> {
  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      _isBackendReachable = false;
      return false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${StreamIOAPIConfig.baseURL}${StreamIOAPIConfig.endpoints.health}`,
      { signal: controller.signal },
    );

    clearTimeout(timeout);
    _isBackendReachable = response.ok;

    if (response.ok) {
      await AsyncStorage.setItem(STORAGE_KEYS.lastConnected, new Date().toISOString());
    }

    return _isBackendReachable;
  } catch {
    _isBackendReachable = false;
    return false;
  }
}

export function startConnectivityMonitor(intervalMs = 30000): void {
  if (_checkInterval) return;
  checkStreamIOBackend();
  _checkInterval = setInterval(checkStreamIOBackend, intervalMs);
}

export function stopConnectivityMonitor(): void {
  if (_checkInterval) {
    clearInterval(_checkInterval);
    _checkInterval = null;
  }
}

// Cache past streams for offline viewing
export async function cachePastStreams(streams: any[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.pastStreams, JSON.stringify(streams));
}

export async function getCachedPastStreams(): Promise<any[]> {
  const cached = await AsyncStorage.getItem(STORAGE_KEYS.pastStreams);
  return cached ? JSON.parse(cached) : [];
}

// Offline command queue (for terminal commands issued while offline)
interface QueuedCommand {
  id: string;
  command: string;
  timestamp: string;
}

export async function queueOfflineCommand(command: string): Promise<void> {
  const queue = await getOfflineQueue();
  queue.push({
    id: `cmd-${Date.now()}`,
    command,
    timestamp: new Date().toISOString(),
  });
  await AsyncStorage.setItem(STORAGE_KEYS.offlineQueue, JSON.stringify(queue));
}

export async function getOfflineQueue(): Promise<QueuedCommand[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.offlineQueue);
  return raw ? JSON.parse(raw) : [];
}

export async function clearOfflineQueue(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.offlineQueue);
}

export async function getLastConnectedTime(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.lastConnected);
}
