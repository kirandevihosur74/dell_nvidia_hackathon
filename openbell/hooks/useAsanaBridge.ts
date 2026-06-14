import { useEffect, useCallback, useState } from "react";
import { asanaBridge, type BridgeActivity } from "@/services/bridge/asanaBridge";
import { useGatewayStore } from "@/stores/gatewayStore";
import type { AsanaTask } from "@/types/asana";

/**
 * Hook for Asana ↔ OpenClaw bridge functionality.
 *
 * Provides:
 * - Bridge activity feed (agent-initiated task operations)
 * - Board refresh trigger (when agent modifies tasks)
 * - Actions to send task context to the agent
 */
export function useAsanaBridge(onBoardRefresh?: () => void) {
  const { activeSessionId, connectionStatus } = useGatewayStore();
  const [activities, setActivities] = useState<BridgeActivity[]>([]);

  // Start bridge and subscribe to events
  useEffect(() => {
    asanaBridge.start();

    const unsubActivity = asanaBridge.onActivity((activity) => {
      setActivities((prev) => [activity, ...prev].slice(0, 100)); // Keep last 100
    });

    const unsubRefresh = onBoardRefresh
      ? asanaBridge.onBoardRefresh(onBoardRefresh)
      : undefined;

    return () => {
      unsubActivity();
      unsubRefresh?.();
      asanaBridge.stop();
    };
  }, [onBoardRefresh]);

  /** Ask the agent about a task. */
  const askAgentAboutTask = useCallback(
    (task: AsanaTask, question?: string) => {
      if (!activeSessionId || connectionStatus !== "connected") return;
      asanaBridge.askAgentAboutTask(task, activeSessionId, question);
    },
    [activeSessionId, connectionStatus]
  );

  /** Delegate a task to the agent. */
  const delegateTaskToAgent = useCallback(
    (task: AsanaTask, instructions?: string) => {
      if (!activeSessionId || connectionStatus !== "connected") return;
      asanaBridge.delegateTaskToAgent(task, activeSessionId, instructions);
    },
    [activeSessionId, connectionStatus]
  );

  /** Notify agent of a user board action. */
  const notifyAgentOfChange = useCallback(
    (action: string, task: AsanaTask) => {
      if (!activeSessionId || connectionStatus !== "connected") return;
      asanaBridge.notifyAgentOfBoardChange(action, task, activeSessionId);
    },
    [activeSessionId, connectionStatus]
  );

  const isAgentConnected = connectionStatus === "connected" && !!activeSessionId;

  return {
    activities,
    isAgentConnected,
    askAgentAboutTask,
    delegateTaskToAgent,
    notifyAgentOfChange,
  };
}
