import { create } from "zustand";
import type { GatewayConfig, GatewaySession, GatewayAgent, GatewayProfile, ConnectionStatus, ApprovalStatus } from "@/types/gateway";
import type { OpenClawMessage } from "@/types/openclaw";

interface GatewayState {
  // Connection
  gateways: GatewayConfig[];
  activeGatewayId: string | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;

  // Agents
  agents: GatewayAgent[];
  activeAgentId: string | null;

  // Profiles
  profiles: GatewayProfile[];
  activeProfileId: string | null;

  // Sessions
  sessions: GatewaySession[];
  activeSessionId: string | null;

  // Chat
  messages: OpenClawMessage[];
  streamingContent: string;
  isStreaming: boolean;

  // Pairing
  pairingCode: string | null;
  pairingDirection: "display" | "enter" | null;

  // Device Approval (QR / Invite / Discovery flows)
  approvalStatus: ApprovalStatus | null;

  // Actions — Connection
  setGateways: (gateways: GatewayConfig[]) => void;
  addGateway: (gateway: GatewayConfig) => void;
  updateGateway: (id: string, updates: Partial<GatewayConfig>) => void;
  removeGateway: (id: string) => void;
  setActiveGateway: (id: string | null) => void;
  setConnectionStatus: (status: ConnectionStatus, error?: string | null) => void;

  // Actions — Agents
  setAgents: (agents: GatewayAgent[]) => void;
  setActiveAgent: (id: string | null) => void;

  // Actions — Profiles
  setProfiles: (profiles: GatewayProfile[]) => void;
  setActiveProfile: (profileId: string | null) => void;
  addProfile: (profile: GatewayProfile) => void;
  removeProfile: (profileId: string) => void;
  updateProfile: (id: string, updates: Partial<Pick<GatewayProfile, "displayName" | "avatarColor">>) => void;

  // Actions — Sessions
  setSessions: (sessions: GatewaySession[]) => void;
  setActiveSession: (id: string | null) => void;

  // Actions — Chat
  addMessage: (message: OpenClawMessage) => void;
  updateMessageStatus: (id: string, status: OpenClawMessage["status"]) => void;
  setMessages: (messages: OpenClawMessage[] | ((prev: OpenClawMessage[]) => OpenClawMessage[])) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (token: string) => void;
  setIsStreaming: (streaming: boolean) => void;

  // Actions — Pairing
  setPairingState: (code: string | null, direction: "display" | "enter" | null) => void;

  // Actions — Approval
  setApprovalStatus: (status: ApprovalStatus | null) => void;

  // Reset
  reset: () => void;
}

export const useGatewayStore = create<GatewayState>((set) => ({
  // Connection
  gateways: [],
  activeGatewayId: null,
  connectionStatus: "disconnected",
  connectionError: null,

  // Agents
  agents: [],
  activeAgentId: null,

  // Profiles
  profiles: [],
  activeProfileId: null,

  // Sessions
  sessions: [],
  activeSessionId: null,

  // Chat
  messages: [],
  streamingContent: "",
  isStreaming: false,

  // Pairing
  pairingCode: null,
  pairingDirection: null,

  // Device Approval
  approvalStatus: null,

  // Actions — Connection
  setGateways: (gateways) => set({ gateways }),
  addGateway: (gateway) => set((s) => ({ gateways: [...s.gateways, gateway] })),
  updateGateway: (id, updates) =>
    set((s) => ({
      gateways: s.gateways.map((g) => (g.id === id ? { ...g, ...updates } : g)),
    })),
  removeGateway: (id) =>
    set((s) => ({
      gateways: s.gateways.filter((g) => g.id !== id),
      activeGatewayId: s.activeGatewayId === id ? null : s.activeGatewayId,
    })),
  setActiveGateway: (id) => set({ activeGatewayId: id }),
  setConnectionStatus: (status, error = null) =>
    set({ connectionStatus: status, connectionError: error }),

  // Actions — Agents
  setAgents: (agents) => {
    set((s) => ({
      agents,
      // Auto-select first agent if none active
      activeAgentId: s.activeAgentId && agents.some((a) => a.id === s.activeAgentId)
        ? s.activeAgentId
        : agents[0]?.id || null,
    }));
  },
  setActiveAgent: (id) => set({ activeAgentId: id }),

  // Actions — Profiles
  setProfiles: (profiles) => set({ profiles }),
  setActiveProfile: (profileId) => set({ activeProfileId: profileId }),
  addProfile: (profile) => set((s) => ({ profiles: [...s.profiles, profile] })),
  removeProfile: (profileId) =>
    set((s) => ({
      profiles: s.profiles.filter((p) => p.id !== profileId),
      activeProfileId: s.activeProfileId === profileId
        ? s.profiles.find((p) => p.isDefault)?.id || null
        : s.activeProfileId,
    })),
  updateProfile: (id, updates) =>
    set((s) => ({
      profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),

  // Actions — Sessions
  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (id) => set({ activeSessionId: id }),

  // Actions — Chat
  addMessage: (message) =>
    set((s) => {
      // Deduplicate: skip if a message with this ID already exists
      if (s.messages.some((m) => m.id === message.id)) return s;
      return { messages: [...s.messages, message] };
    }),
  updateMessageStatus: (id, status) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, status } : m)),
    })),
  setMessages: (messages) =>
    set((s) => ({
      messages: typeof messages === "function" ? messages(s.messages) : messages,
    })),
  setStreamingContent: (content) => set({ streamingContent: content }),
  appendStreamingContent: (token) =>
    set((s) => ({ streamingContent: s.streamingContent + token })),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  // Actions — Pairing
  setPairingState: (code, direction) =>
    set({ pairingCode: code, pairingDirection: direction }),

  // Actions — Approval
  setApprovalStatus: (status) => set({ approvalStatus: status }),

  // Reset
  reset: () =>
    set({
      activeGatewayId: null,
      connectionStatus: "disconnected",
      connectionError: null,
      profiles: [],
      activeProfileId: null,
      agents: [],
      activeAgentId: null,
      sessions: [],
      activeSessionId: null,
      messages: [],
      streamingContent: "",
      isStreaming: false,
      pairingCode: null,
      pairingDirection: null,
      approvalStatus: null,
    }),
}));
