// Inference store — centralized state for the multi-agent inference system
//
// Manages: inference status, active agents, annotation buffer,
// chat messages, budget display, and per-viewer toggles.

import { create } from 'zustand';
import {
  InferenceStatus,
  AgentRuntimeState,
  AgentStatus,
  AnnotationFrame,
  InferenceChatMessage,
  ViewerAgentState,
  PipelineConfig,
  QAStatus,
} from '@/types/streamio/inference';

interface BudgetDisplay {
  tokensUsed: number;
  estimatedCost: number;
  requestsThisMinute: number;
  budgetRemaining: number;
}

interface InferenceState {
  // Status
  status: InferenceStatus;
  activePipelineId: string | null;

  // Agent runtime states
  agentStates: Record<string, AgentRuntimeState>;

  // Annotation buffer (last N frames per agent)
  annotations: Record<string, AnnotationFrame>; // keyed by agentId, latest frame only

  // Chat messages
  chatMessages: InferenceChatMessage[];
  maxChatHistory: number;

  // Budget
  budget: BudgetDisplay;

  // Viewer toggles (local viewer)
  viewerToggles: ViewerAgentState;

  // Current frame
  currentFrameId: string | null;

  // Q&A state
  qaStatus: QAStatus;
  qaSessionActive: boolean;
  qaVoiceId: string; // ElevenLabs voice ID for Q&A responses

  // Actions — Status
  setStatus: (status: InferenceStatus) => void;
  setActivePipelineId: (id: string | null) => void;

  // Actions — Agent State
  setAgentStatus: (agentId: string, status: AgentStatus) => void;
  initAgentState: (agentId: string) => void;
  removeAgentState: (agentId: string) => void;
  incrementAgentFrames: (agentId: string) => void;
  incrementAgentTokens: (agentId: string, tokens: number) => void;
  incrementAgentErrors: (agentId: string) => void;

  // Actions — Annotations
  setAnnotations: (agentId: string, frame: AnnotationFrame) => void;
  clearAnnotations: (agentId?: string) => void;

  // Actions — Chat
  addChatMessage: (message: InferenceChatMessage) => void;
  updateChatMessage: (messageId: string, updates: Partial<InferenceChatMessage>) => void;
  appendChatToken: (messageId: string, token: string) => void;
  clearChat: () => void;

  // Actions — Budget
  updateBudget: (budget: Partial<BudgetDisplay>) => void;

  // Actions — Viewer Toggles
  setAgentToggle: (agentId: string, field: 'annotationsVisible' | 'chatVisible' | 'overlayVisible', value: boolean) => void;
  initAgentToggle: (agentId: string) => void;
  removeAgentToggle: (agentId: string) => void;

  // Actions — Frame
  setCurrentFrameId: (frameId: string) => void;

  // Actions — Q&A
  setQAStatus: (status: QAStatus) => void;
  setQASessionActive: (active: boolean) => void;
  setQAVoiceId: (voiceId: string) => void;

  // Actions — Reset
  reset: () => void;
}

const DEFAULT_BUDGET: BudgetDisplay = {
  tokensUsed: 0,
  estimatedCost: 0,
  requestsThisMinute: 0,
  budgetRemaining: 0,
};

export const useStreamIOInferenceStore = create<InferenceState>()((set) => ({
  status: 'idle',
  activePipelineId: null,
  agentStates: {},
  annotations: {},
  chatMessages: [],
  maxChatHistory: 200,
  budget: { ...DEFAULT_BUDGET },
  viewerToggles: {},
  currentFrameId: null,
  qaStatus: 'idle',
  qaSessionActive: false,
  qaVoiceId: 'EXAVITQu4vr4xnSDxMaL', // Sarah (default)

  // ─── Status ──────────────────────────────────────────────────────

  setStatus: (status) => set({ status }),

  setActivePipelineId: (activePipelineId) => set({ activePipelineId }),

  // ─── Agent State ─────────────────────────────────────────────────

  setAgentStatus: (agentId, status) =>
    set((state) => ({
      agentStates: {
        ...state.agentStates,
        [agentId]: { ...state.agentStates[agentId], status },
      },
    })),

  initAgentState: (agentId) =>
    set((state) => ({
      agentStates: {
        ...state.agentStates,
        [agentId]: {
          agentId,
          status: 'idle',
          lastInferenceAt: null,
          framesProcessed: 0,
          tokensUsed: 0,
          errors: 0,
        },
      },
    })),

  removeAgentState: (agentId) =>
    set((state) => {
      const { [agentId]: _, ...rest } = state.agentStates;
      return { agentStates: rest };
    }),

  incrementAgentFrames: (agentId) =>
    set((state) => {
      const agent = state.agentStates[agentId];
      if (!agent) return state;
      return {
        agentStates: {
          ...state.agentStates,
          [agentId]: {
            ...agent,
            framesProcessed: agent.framesProcessed + 1,
            lastInferenceAt: Date.now(),
          },
        },
      };
    }),

  incrementAgentTokens: (agentId, tokens) =>
    set((state) => {
      const agent = state.agentStates[agentId];
      if (!agent) return state;
      return {
        agentStates: {
          ...state.agentStates,
          [agentId]: { ...agent, tokensUsed: agent.tokensUsed + tokens },
        },
      };
    }),

  incrementAgentErrors: (agentId) =>
    set((state) => {
      const agent = state.agentStates[agentId];
      if (!agent) return state;
      return {
        agentStates: {
          ...state.agentStates,
          [agentId]: { ...agent, errors: agent.errors + 1, status: 'error' },
        },
      };
    }),

  // ─── Annotations ─────────────────────────────────────────────────

  setAnnotations: (agentId, frame) =>
    set((state) => ({
      annotations: { ...state.annotations, [agentId]: frame },
    })),

  clearAnnotations: (agentId) =>
    set((state) => {
      if (agentId) {
        const { [agentId]: _, ...rest } = state.annotations;
        return { annotations: rest };
      }
      return { annotations: {} };
    }),

  // ─── Chat ────────────────────────────────────────────────────────

  addChatMessage: (message) =>
    set((state) => {
      const messages = [...state.chatMessages, message];
      // Trim to max history
      if (messages.length > state.maxChatHistory) {
        return { chatMessages: messages.slice(-state.maxChatHistory) };
      }
      return { chatMessages: messages };
    }),

  updateChatMessage: (messageId, updates) =>
    set((state) => ({
      chatMessages: state.chatMessages.map((m) =>
        m.id === messageId ? { ...m, ...updates } : m,
      ),
    })),

  appendChatToken: (messageId, token) =>
    set((state) => ({
      chatMessages: state.chatMessages.map((m) =>
        m.id === messageId
          ? { ...m, content: m.content + token, tokenCount: m.tokenCount + 1 }
          : m,
      ),
    })),

  clearChat: () => set({ chatMessages: [] }),

  // ─── Budget ──────────────────────────────────────────────────────

  updateBudget: (budget) =>
    set((state) => ({
      budget: { ...state.budget, ...budget },
    })),

  // ─── Viewer Toggles ─────────────────────────────────────────────

  setAgentToggle: (agentId, field, value) =>
    set((state) => ({
      viewerToggles: {
        ...state.viewerToggles,
        [agentId]: {
          ...state.viewerToggles[agentId],
          [field]: value,
        },
      },
    })),

  initAgentToggle: (agentId) =>
    set((state) => ({
      viewerToggles: {
        ...state.viewerToggles,
        [agentId]: {
          annotationsVisible: true,
          chatVisible: true,
          overlayVisible: true,
        },
      },
    })),

  removeAgentToggle: (agentId) =>
    set((state) => {
      const { [agentId]: _, ...rest } = state.viewerToggles;
      return { viewerToggles: rest };
    }),

  // ─── Frame ───────────────────────────────────────────────────────

  setCurrentFrameId: (currentFrameId) => set({ currentFrameId }),

  // ─── Q&A ──────────────────────────────────────────────────────────

  setQAStatus: (qaStatus) => set({ qaStatus }),

  setQASessionActive: (qaSessionActive) => set({ qaSessionActive }),

  setQAVoiceId: (qaVoiceId) => set({ qaVoiceId }),

  // ─── Reset ───────────────────────────────────────────────────────

  reset: () =>
    set({
      status: 'idle',
      activePipelineId: null,
      agentStates: {},
      annotations: {},
      chatMessages: [],
      budget: { ...DEFAULT_BUDGET },
      viewerToggles: {},
      currentFrameId: null,
      qaStatus: 'idle',
      qaSessionActive: false,
      qaVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    }),
}));
