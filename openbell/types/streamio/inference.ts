// Stream inference types — multi-agent AI overlay system
//
// Covers: agent definitions, pipeline configs, annotations,
// chat messages, budget tracking, and WebSocket protocol.

// ─── Agent Definition ────────────────────────────────────────────────

export type AgentCategory =
  | 'real-estate'
  | 'analysis'
  | 'productivity'
  | 'lifestyle'
  | 'music'
  | 'general';

export interface InferenceAgent {
  id: string;
  name: string;
  description: string;
  icon: string;       // lucide icon name
  color: string;      // hex color for annotations + chat badge
  category: AgentCategory;

  // Gemini config
  model: GeminiModel;
  systemPrompt: string;
  analysisPrompt: string;
  temperature: number;
  maxOutputTokens: number;

  // Pipeline behavior
  inputType: AgentInputType;
  outputType: AgentOutputType;

  // Rate limiting
  minIntervalMs: number;
  priority: number;   // 1-10, higher = processed first
}

export type GeminiModel = 'gemini-2.0-flash' | 'gemini-2.0-pro' | 'gemini-2.5-flash' | 'gemini-2.5-pro';
export type AgentInputType = 'frame' | 'frame+context' | 'frame+audio' | 'interactive';
export type AgentOutputType = 'annotations' | 'chat' | 'both';

// ─── Pipeline Configuration ──────────────────────────────────────────

export interface PipelineConfig {
  id: string;
  name: string;
  stages: PipelineStage[];
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStage {
  stageIndex: number;
  agents: string[];                    // agent IDs to run in parallel at this stage
  mergeStrategy: MergeStrategy;
  passContextToNext: boolean;
}

export type MergeStrategy = 'concat' | 'dedupe';

// ─── Annotations ─────────────────────────────────────────────────────

export interface AnnotationFrame {
  frameId: string;
  timestamp: number;
  agentId: string;
  annotations: Annotation[];
}

export interface Annotation {
  type: 'box' | 'label';
  // Normalized 0-1 coordinates relative to frame dimensions
  x: number;
  y: number;
  width: number;
  height: number;
  // Display
  label: string;
  confidence: number;
  color: string;
}

// ─── Chat Messages ───────────────────────────────────────────────────

export interface InferenceChatMessage {
  id: string;
  agentId: string;
  agentName: string;
  agentColor: string;
  agentIcon: string;

  content: string;
  isStreaming: boolean;
  isComplete: boolean;

  frameId: string;
  timestamp: number;
  tokenCount: number;
}

// ─── Budget & Rate Limiting ──────────────────────────────────────────

export interface StreamBudget {
  streamId: string;

  // Limits
  maxTokensPerStream: number;
  maxCostPerStream: number;
  maxRequestsPerMinute: number;

  // Current usage
  tokensUsed: number;
  estimatedCost: number;
  requestsThisMinute: number;

  // Action when budget exceeded
  onBudgetExceeded: BudgetAction;
}

export type BudgetAction = 'pause' | 'degrade' | 'stop';

export type BudgetTier = 'free' | 'pro' | 'enterprise';

export interface BudgetTierConfig {
  requestsPerMinute: number;
  tokensPerStream: number;
  estimatedCostPerStream: number;
}

// ─── Q&A Types ──────────────────────────────────────────────────

export interface QASubmission {
  streamId: string;
  question: string;
  imageData: string;          // data:image/jpeg;base64,...
  frameId?: string;           // optional, for linking to annotations
}

export interface QAMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  frameId?: string;
  timestamp: number;
}

export type QAStatus = 'idle' | 'recording' | 'processing' | 'speaking';

// ─── WebSocket Protocol ──────────────────────────────────────────────

// Server → Client
export type InferenceWSMessage =
  | { type: 'chat_token'; agentId: string; messageId: string; token: string }
  | { type: 'chat_complete'; agentId: string; messageId: string; content: string }
  | { type: 'annotations'; agentId: string; frameId: string; annotations: Annotation[] }
  | { type: 'agent_status'; agentId: string; status: AgentStatus }
  | { type: 'cost_update'; totalTokens: number; estimatedCost: number; budgetRemaining: number }
  | { type: 'qa_token'; agentId: 'live-qa'; messageId: string; token: string }
  | { type: 'qa_complete'; agentId: 'live-qa'; messageId: string; content: string }
  | { type: 'qa_processing'; agentId: 'live-qa'; status: 'thinking' };

// Client → Server
export type InferenceWSCommand =
  | { type: 'toggle_agent'; agentId: string; enabled: boolean }
  | { type: 'sync_state' };

export type AgentStatus = 'active' | 'idle' | 'error' | 'rate_limited';

// ─── Inference Submission ────────────────────────────────────────────

export interface FrameSubmission {
  streamId: string;
  frameId: string;
  imageData: string;   // data:image/jpeg;base64,...
  pipelineId: string;
  resolution: { width: number; height: number };
  audioTranscript?: string;  // STT transcript for frame+audio agents
}

export interface FrameSubmissionResponse {
  frameId: string;
  estimatedLatencyMs: number;
  agentsQueued: string[];
}

// ─── Viewer State ────────────────────────────────────────────────────

export interface ViewerAgentToggle {
  annotationsVisible: boolean;
  chatVisible: boolean;
  overlayVisible: boolean;
}

export type ViewerAgentState = Record<string, ViewerAgentToggle>;

// ─── Inference Service State ─────────────────────────────────────────

export type InferenceStatus = 'idle' | 'connecting' | 'active' | 'paused' | 'error';

export interface AgentRuntimeState {
  agentId: string;
  status: AgentStatus;
  lastInferenceAt: number | null;
  framesProcessed: number;
  tokensUsed: number;
  errors: number;
}
