import { useEffect, useRef } from "react";
import NetInfo from "@react-native-community/netinfo";
import { useOfflineStore } from "@/stores/offlineStore";
import { api } from "@/services/apiClient";

/**
 * Monitors network connectivity and flushes the pending action queue
 * when the device comes back online.
 */
export function useOfflineSync() {
  const { isOffline, setOffline, pendingActions, removePendingAction, loadFromStorage } =
    useOfflineStore();
  const flushing = useRef(false);

  // Load cached data on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Subscribe to network state changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setOffline(offline);
    });
    return () => unsubscribe();
  }, [setOffline]);

  // Flush pending actions when coming back online
  useEffect(() => {
    if (isOffline || flushing.current || pendingActions.length === 0) return;

    const flush = async () => {
      flushing.current = true;

      for (const action of pendingActions) {
        try {
          switch (action.type) {
            case "move_task":
              await api.moveTask(
                action.payload.taskId as string,
                action.payload.completed as boolean
              );
              break;
            // Add more action types as needed
          }
          removePendingAction(action.id);
        } catch {
          // Stop flushing on first failure — retry next time
          break;
        }
      }

      flushing.current = false;
    };

    flush();
  }, [isOffline, pendingActions, removePendingAction]);
}
