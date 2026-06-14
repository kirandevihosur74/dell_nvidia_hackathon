import { useEffect, useCallback, useMemo } from "react";
import { useGatewayStore } from "@/stores/gatewayStore";
import { gatewayClient, pairingService } from "@/services/gateway";
import { sessionManager } from "@/services/gateway/sessionManager";
import { getProvider } from "@/services/gateway/providers/registry";
import type { GatewayConfig, GatewayAgent, ConnectionStatus, PairingChallenge, GatewayMessage } from "@/types/gateway";
import type { ProviderType } from "@/services/gateway/providers/types";

export function useGateway() {
  const {
    gateways,
    activeGatewayId,
    connectionStatus,
    connectionError,
    agents,
    activeAgentId,
    sessions,
    activeSessionId,
    messages,
    streamingContent,
    isStreaming,
    pairingCode,
    pairingDirection,
    setGateways,
    addGateway,
    removeGateway: removeGatewayFromStore,
    setActiveGateway,
    setConnectionStatus,
    setAgents,
    setActiveAgent,
    setSessions,
    setActiveSession,
    addMessage,
    updateMessageStatus,
    setStreamingContent,
    appendStreamingContent,
    setIsStreaming,
    setPairingState,
  } = useGatewayStore();

  // Load saved gateways on mount
  useEffect(() => {
    pairingService.loadGateways().then(setGateways);
  }, [setGateways]);

  // Subscribe to connection status
  useEffect(() => {
    const unsub = gatewayClient.onStatus((status: ConnectionStatus, error?: string) => {
      setConnectionStatus(status, error || null);
    });
    return unsub;
  }, [setConnectionStatus]);

  // Subscribe to pairing challenges
  useEffect(() => {
    pairingService.start();
    const unsub = pairingService.onChallenge((challenge: PairingChallenge) => {
      setPairingState(challenge.code, challenge.direction);
    });
    return () => {
      unsub();
      pairingService.stop();
    };
  }, [setPairingState]);

  // Resolve provider based on the active gateway's config
  const provider = useMemo(() => {
    const gw = gateways.find((g) => g.id === activeGatewayId);
    return getProvider(gw?.providerType || "openclaw");
  }, [gateways, activeGatewayId]);

  // Start gateway session sync when connected (for subagent name resolution)
  useEffect(() => {
    if (connectionStatus === "connected" && activeGatewayId) {
      sessionManager.setActiveGateway(activeGatewayId);
      sessionManager.startSync();
    } else {
      sessionManager.stopSync();
    }
  }, [connectionStatus, activeGatewayId]);

  // Discover agents when connected using the req/res protocol
  useEffect(() => {
    if (connectionStatus !== "connected") return;

    const discoverAgents = async () => {
      try {
        const methods = provider.agentDiscoveryMethods();
        let result: Record<string, unknown> | undefined;

        for (let i = 0; i < methods.length; i++) {
          try {
            result = await gatewayClient.request(methods[i]) as Record<string, unknown>;
            break; // success — stop trying
          } catch {
            if (i === methods.length - 1) throw new Error("All discovery methods failed");
          }
        }

        if (result) {
          const agentList = provider.parseAgents(result);
          if (agentList.length > 0) {
            setAgents(agentList);
          }
        }

        // Also set a default session — the Gateway uses sessionKey "main" by default
        if (!activeSessionId) {
          setActiveSession("main");
        }
      } catch {
        // Not critical — agents/nodes may not be available
      }
    };

    discoverAgents();
  }, [connectionStatus, provider, setAgents, activeSessionId, setActiveSession]);

  // --- Actions ---

  const connectToGateway = useCallback(
    async (config: GatewayConfig) => {
      setActiveGateway(config.id);
      sessionManager.setActiveGateway(config.id);
      await gatewayClient.connect(config);
      sessionManager.startSync();
    },
    [setActiveGateway]
  );

  const disconnectGateway = useCallback(() => {
    sessionManager.stopSync();
    gatewayClient.disconnect();
    setActiveGateway(null);
    sessionManager.setActiveGateway(null);
  }, [setActiveGateway]);

  const retryConnection = useCallback(() => {
    const gw = gateways.find((g) => g.id === activeGatewayId);
    if (gw) {
      gatewayClient.connect(gw);
    }
  }, [gateways, activeGatewayId]);

  const addNewGateway = useCallback(
    async (name: string, host: string, port?: number, authMethod?: GatewayConfig["authMethod"], password?: string, providerType?: ProviderType) => {
      const config = pairingService.createGatewayConfig(name, host, port, authMethod, providerType);
      if (password) {
        config.password = password;
      }
      await pairingService.saveGateway(config);
      addGateway(config);
      return config;
    },
    [addGateway]
  );

  const updateGateway = useGatewayStore((s) => s.updateGateway);

  const editGateway = useCallback(
    async (id: string, updates: Partial<GatewayConfig>) => {
      const existing = gateways.find((g) => g.id === id);
      if (!existing) return;
      const updated = { ...existing, ...updates };
      await pairingService.saveGateway(updated);
      updateGateway(id, updates);
    },
    [gateways, updateGateway]
  );

  const deleteGateway = useCallback(
    async (id: string) => {
      if (activeGatewayId === id) {
        gatewayClient.disconnect();
      }
      await pairingService.removeGateway(id);
      removeGatewayFromStore(id);
    },
    [activeGatewayId, removeGatewayFromStore]
  );

  const submitPairingCode = useCallback((code: string) => {
    pairingService.submitPairingCode(code);
    setPairingState(null, null);
  }, [setPairingState]);

  const selectAgent = useCallback(
    (agentId: string) => {
      setActiveAgent(agentId);
      // Switch session key to agent-specific one
      const sessionKey = agentId === "main" ? "main" : `agent:${agentId}`;
      setActiveSession(sessionKey);
    },
    [setActiveAgent, setActiveSession]
  );

  const createSession = useCallback((name?: string) => {
    // In the Gateway, sessions are just sessionKey strings
    const sessionKey = name || `session_${Date.now()}`;
    setActiveSession(sessionKey);
  }, [setActiveSession]);

  const switchSession = useCallback(
    (sessionId: string) => {
      setActiveSession(sessionId);
    },
    [setActiveSession]
  );

  return {
    // State
    gateways,
    activeGatewayId,
    connectionStatus,
    connectionError,
    agents,
    activeAgentId,
    sessions,
    activeSessionId,
    messages,
    streamingContent,
    isStreaming,
    pairingCode,
    pairingDirection,

    // Actions
    connectToGateway,
    disconnectGateway,
    retryConnection,
    addNewGateway,
    editGateway,
    deleteGateway,
    submitPairingCode,
    sendMessage: () => {}, // Sending is handled by useOpenClawStream
    selectAgent,
    createSession,
    switchSession,
  };
}
