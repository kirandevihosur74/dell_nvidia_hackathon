// Inference service — orchestrates frame submission, WebSocket streaming, and result routing
//
// This is the main entry point for the inference system. It:
//   1. Captures frames at the configured interval
//   2. Submits them to the server with the active pipeline config
//   3. Maintains a WebSocket connection for streaming results
//   4. Routes annotations and chat tokens to the inference store
//   5. Respects budget limits and adaptive throttling

import { useStreamIOInferenceStore } from '@/stores/streamio/inferenceStore';
import { useStreamIOStreamStore } from '@/stores/streamio/streamStore';
import { streamIOApiClient } from '@/services/streamio/apiClient';
import { StreamIOAPIConfig } from '@/constants/streamio/config';
import { useStreamIOAuthStore } from '@/stores/streamio/authStore';
import { getAgentById } from './agentRegistry';
import { getActivePipeline, buildExecutionPlan } from './pipelineService';
import {
  canMakeRequest,
  recordUsage,
  getRecommendedIntervalMs,
  getBudgetAction,
  getThrottleLevel,
  onRateLimitResponse,
  resetBackoff,
  isBackedOff,
  getBackoffDelay,
  initBudget,
  resetBudget,
} from './inferenceBudget';
import { startBudgetMonitor, stopBudgetMonitor } from './inferenceBudgetMonitor';
import {
  FrameSubmission,
  FrameSubmissionResponse,
  InferenceWSMessage,
  InferenceWSCommand,
  InferenceChatMessage,
  AnnotationFrame,
  Annotation,
} from '@/types/streamio/inference';
import { safelyTakePhoto } from './cameraRef';
import { io, Socket } from 'socket.io-client';
import * as STTService from './sttService';
import * as LiveQA from './liveQAService';
import * as AudioSession from './audioSessionService';
import { getActivePipelineAgentInputTypes } from './pipelineService';
import { getServerStreamId } from './hlsService';

// ─── State ───────────────────────────────────────────────────────────

let socket: Socket | null = null;
let frameInterval: ReturnType<typeof setInterval> | null = null;
let reconnectAttempts = 0;
let frameCounter = 0;

const MAX_RECONNECT = 5;

// ─── Rolling Audio Transcript Buffer ────────────────────────────────
// When frame+audio agents are active, we record audio between frame
// captures and transcribe it. The transcript is attached to the next
// frame submission so the agent gets both visual + spoken context.

let audioEnabled = false;
let audioRecordingCycle = false;
let currentTranscript: string | null = null;

async function startAudioCapture(): Promise<void> {
  if (audioEnabled) return;

  // Check if native audio module is available (requires dev build, not Expo Go)
  if (!STTService.isAudioAvailable()) {
    console.warn('[Inference Audio] Audio recording unavailable in this runtime (Expo Go). frame+audio agents will use video-only mode.');
    return;
  }

  const hasPermission = await STTService.requestPermission();
  if (!hasPermission) {
    console.warn('[Inference Audio] Microphone permission denied — frame+audio agents will use video-only mode');
    return;
  }
  audioEnabled = true;
  cycleAudioRecording();
}

function stopAudioCapture(): void {
  audioEnabled = false;
  audioRecordingCycle = false;
  currentTranscript = null;
  STTService.cancelRecording();
}

async function cycleAudioRecording(): Promise<void> {
  if (!audioEnabled || audioRecordingCycle) return;
  audioRecordingCycle = true;

  while (audioEnabled) {
    try {
      await STTService.startRecording();
      // Record for the frame interval duration (matches frame capture rate)
      const intervalMs = Math.max(getRecommendedIntervalMs(), 3000);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      if (!audioEnabled) break;

      const uri = await STTService.stopRecording();
      if (uri) {
        const transcript = await STTService.transcribe(uri);
        if (transcript && transcript.trim().length > 0) {
          currentTranscript = transcript.trim();
        }
      }
    } catch (err: any) {
      console.warn('[Inference Audio] Cycle error:', err.message);
      // Brief pause before retrying
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  audioRecordingCycle = false;
}

/** Pause passive audio capture (called by audioSessionService during Q&A). */
function pausePassiveAudio(): void {
  if (!audioEnabled) return;
  console.log('[Inference Audio] Pausing passive capture for Q&A');
  audioEnabled = false;
  STTService.cancelRecording();
}

/** Resume passive audio capture after Q&A completes. */
function resumePassiveAudio(): void {
  const inputTypes = getActivePipelineAgentInputTypes();
  if (!inputTypes.has('frame+audio')) return;

  console.log('[Inference Audio] Resuming passive capture after Q&A');
  audioEnabled = true;
  audioRecordingCycle = false;
  cycleAudioRecording();
}

function consumeTranscript(): string | undefined {
  if (!currentTranscript) return undefined;
  const transcript = currentTranscript;
  currentTranscript = null;
  return transcript;
}

// ─── Lifecycle ───────────────────────────────────────────────────────

export async function startInference(): Promise<boolean> {
  const inferenceStore = useStreamIOInferenceStore.getState();
  const streamStore = useStreamIOStreamStore.getState();

  if (inferenceStore.status === 'active') return false;

  const pipeline = getActivePipeline();
  if (!pipeline) {
    console.warn('[Inference] No active pipeline configured');
    return false;
  }

  const plan = buildExecutionPlan(pipeline);
  if (plan.totalAgents === 0) {
    console.warn('[Inference] Pipeline has no valid agents');
    return false;
  }

  console.log('[Inference] Starting with pipeline:', pipeline.name, 'agents:', plan.totalAgents);

  inferenceStore.setStatus('connecting');
  inferenceStore.setActivePipelineId(pipeline.id);

  // Initialize agent states and toggles
  const allAgentIds: string[] = [];
  for (const stage of plan.stages) {
    for (const agentId of stage.agentIds) {
      inferenceStore.initAgentState(agentId);
      inferenceStore.initAgentToggle(agentId);
      allAgentIds.push(agentId);
    }
  }

  // Initialize budget from subscription tier
  const tier = 'pro'; // TODO: read from subscription store
  const streamId = streamStore.activeStreamId!;
  initBudget(streamId, tier);

  // Create session on backend so processFrame knows about our stream
  // Send full agent configs so the backend can register agents it doesn't have
  try {
    const liveScreenSessionId = getServerStreamId();
    console.log('[Inference] Creating backend session for stream:', streamId, 'liveScreenSessionId:', liveScreenSessionId);

    // Build agent config payloads for all agents in the pipeline
    const agentConfigs = allAgentIds
      .map((id) => {
        const agent = getAgentById(id);
        if (!agent) return null;
        return {
          id: agent.id,
          name: agent.name,
          model: agent.model,
          systemPrompt: agent.systemPrompt,
          analysisPrompt: agent.analysisPrompt,
          temperature: agent.temperature,
          maxOutputTokens: agent.maxOutputTokens,
          inputType: agent.inputType === 'frame' ? 'image' : agent.inputType,
          outputType: agent.outputType,
          priority: agent.priority,
          color: agent.color,
          icon: agent.icon,
        };
      })
      .filter(Boolean);

    await streamIOApiClient.post(StreamIOAPIConfig.endpoints.inferenceSubmit.replace('/submit', '/sessions'), {
      streamId,
      liveScreenSessionId,
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        stages: pipeline.stages,
      },
      agents: agentConfigs,
      budget: {
        maxTokens: 100000,
        maxCost: 0.10,
      },
    });
    console.log('[Inference] Backend session created with', agentConfigs.length, 'agent configs');
  } catch (err: any) {
    console.warn('[Inference] Backend session creation failed (non-fatal):', err.message);
    // Non-fatal — frames will still be submitted, backend will handle gracefully
  }

  // Connect WebSocket for streaming results
  connectWebSocket(streamId);

  // Start audio capture if any agent needs frame+audio input
  const inputTypes = getActivePipelineAgentInputTypes();
  if (inputTypes.has('frame+audio')) {
    console.log('[Inference] frame+audio agents detected — starting audio capture');
    startAudioCapture();
  }

  // Hook passive audio pause/resume for Q&A coordination
  AudioSession.setPassiveAudioCallbacks(
    () => { pausePassiveAudio(); },
    () => { resumePassiveAudio(); },
  );

  // Initialize Live Q&A system
  LiveQA.initQA(streamId);

  // Start frame submission loop
  startFrameLoop();

  // Start budget monitor for toast warnings (pass callbacks to avoid require cycle)
  startBudgetMonitor({ onPause: pauseInference, onStop: stopInference });

  inferenceStore.setStatus('active');
  console.log('[Inference] Active — frame loop started');
  return true;
}

export async function stopInference(): Promise<void> {
  const inferenceStore = useStreamIOInferenceStore.getState();
  const streamStore = useStreamIOStreamStore.getState();

  // Tell the backend to stop the inference session (persists transcripts)
  const streamId = streamStore.activeStreamId;
  if (streamId) {
    try {
      await streamIOApiClient.delete(`${StreamIOAPIConfig.endpoints.inferenceSubmit.replace('/submit', '/sessions')}/${streamId}`);
    } catch {
      // Best effort — session may already be gone
    }
  }

  // Stop frame loop
  if (frameInterval) {
    clearInterval(frameInterval);
    frameInterval = null;
  }

  // Destroy Q&A system
  LiveQA.destroyQA();

  // Stop audio capture
  stopAudioCapture();

  // Stop budget monitor
  stopBudgetMonitor();

  // Disconnect WebSocket
  disconnectWebSocket();

  // Reset budget
  resetBudget();

  // Reset
  frameCounter = 0;
  inferenceStore.reset();
}

export function pauseInference(): void {
  if (frameInterval) {
    clearInterval(frameInterval);
    frameInterval = null;
  }
  useStreamIOInferenceStore.getState().setStatus('paused');
}

export function resumeInference(): void {
  const store = useStreamIOInferenceStore.getState();
  if (store.status !== 'paused') return;
  startFrameLoop();
  store.setStatus('active');
}

// ─── Frame Submission Loop ───────────────────────────────────────────

function startFrameLoop(): void {
  if (frameInterval) clearInterval(frameInterval);

  const intervalMs = getRecommendedIntervalMs();
  if (intervalMs < 0) {
    // Budget exceeded
    handleBudgetExceeded();
    return;
  }

  frameInterval = setInterval(() => {
    captureAndSubmitFrame();
  }, intervalMs);
}

function adjustFrameRate(): void {
  const newInterval = getRecommendedIntervalMs();
  if (newInterval < 0) {
    handleBudgetExceeded();
    return;
  }

  // Only restart if interval changed
  if (frameInterval) {
    clearInterval(frameInterval);
    frameInterval = setInterval(() => {
      captureAndSubmitFrame();
    }, newInterval);
  }
}

async function captureAndSubmitFrame(): Promise<void> {
  const streamStore = useStreamIOStreamStore.getState();
  const inferenceStore = useStreamIOInferenceStore.getState();

  if (streamStore.status !== 'streaming') {
    console.log('[Inference] Skipping frame — stream not active:', streamStore.status);
    return;
  }
  if (inferenceStore.status !== 'active') {
    console.log('[Inference] Skipping frame — inference not active:', inferenceStore.status);
    return;
  }

  // Check rate limit
  if (!canMakeRequest()) {
    console.warn('[Inference] Rate limited — skipping frame');
    return;
  }

  // Check backoff
  if (isBackedOff()) {
    const delay = getBackoffDelay();
    if (delay < 0) {
      pauseInference();
      return;
    }
    return; // skip this tick, try next
  }

  // Capture frame from camera (shared mutex prevents AVFoundation conflicts)
  try {
    const base64 = await safelyTakePhoto();
    if (!base64) return; // Camera busy or unavailable

    const frameId = `frame_${++frameCounter}_${Date.now()}`;
    inferenceStore.setCurrentFrameId(frameId);

    console.log('[Inference] Submitting frame:', frameId, 'base64 length:', base64.length);

    // Attach audio transcript if available (for frame+audio agents)
    const audioTranscript = audioEnabled ? consumeTranscript() : undefined;

    await submitFrame({
      streamId: streamStore.activeStreamId!,
      frameId,
      imageData: `data:image/jpeg;base64,${base64}`,
      pipelineId: inferenceStore.activePipelineId!,
      resolution: { width: 1280, height: 720 },
      audioTranscript,
    });

    console.log('[Inference] Frame submitted successfully:', frameId);
    resetBackoff();

    // Check if throttle level changed
    const level = getThrottleLevel();
    if (level !== 'none') {
      adjustFrameRate();
    }
  } catch (error: any) {
    if (error?.statusCode === 429) {
      const delay = onRateLimitResponse();
      if (delay > 0) {
        console.warn(`Gemini 429 — backing off ${delay}ms`);
      } else {
        pauseInference();
      }
    } else {
      console.warn('Frame capture/submit error:', error.message);
    }
  }
}

async function submitFrame(submission: FrameSubmission): Promise<void> {
  try {
    await streamIOApiClient.post<FrameSubmissionResponse>(
      '/api/v1/inference/submit',
      submission,
      undefined,
      StreamIOAPIConfig.timeouts.upload, // 120s — large base64 frames need more time over tunnel
    );
  } catch (error: any) {
    // Re-throw 429s for backoff handling
    if (error?.statusCode === 429) throw error;
    console.error('Frame submission failed:', error.message);
  }
}

// ─── Socket.IO Connection ────────────────────────────────────────────

export function connectWebSocket(streamId: string): void {
  if (socket?.connected) return;

  const token = useStreamIOAuthStore.getState().currentAuth?.authToken;
  const baseUrl = StreamIOAPIConfig.baseURL; // e.g. http://172.20.10.13:3001

  console.log('[Inference WS] Connecting to', baseUrl, '/inference namespace, stream:', streamId);

  socket = io(`${baseUrl}/inference`, {
    transports: ['websocket'],
    auth: token ? { token } : undefined,
    reconnectionAttempts: MAX_RECONNECT,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[Inference WS] Connected, joining stream:', streamId);
    reconnectAttempts = 0;
    socket!.emit('join_stream', { streamId });
    socket!.emit('sync_state');
  });

  socket.on('joined', (data: any) => {
    console.log('[Inference WS] Joined stream:', data?.streamId);
  });

  // Listen for inference events from backend
  socket.on('chat_token', (data: any) => handleWSMessage({ ...data, type: 'chat_token' }));
  socket.on('chat_complete', (data: any) => handleWSMessage({ ...data, type: 'chat_complete' }));
  socket.on('annotations', (data: any) => handleWSMessage({ ...data, type: 'annotations' }));
  socket.on('agent_status', (data: any) => handleWSMessage({ ...data, type: 'agent_status' }));
  socket.on('cost_update', (data: any) => handleWSMessage({ ...data, type: 'cost_update' }));
  socket.on('budget_exceeded', (data: any) => {
    console.warn('[Inference WS] Budget exceeded:', data);
    pauseInference();
  });

  // Q&A-specific events — routed to liveQAService instead of normal chat handlers
  socket.on('qa_token', (data: any) => {
    LiveQA.handleQAToken(data.messageId, data.token);
  });
  socket.on('qa_complete', (data: any) => {
    LiveQA.handleQAComplete(data.messageId, data.content);
  });
  socket.on('qa_processing', (_data: any) => {
    LiveQA.handleQAProcessing();
  });

  socket.on('connect_error', (err) => {
    console.warn('[Inference WS] Connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Inference WS] Disconnected:', reason);
  });
}

function disconnectWebSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

function sendWSCommand(command: InferenceWSCommand): void {
  if (socket?.connected) {
    socket.emit(command.type, command);
  }
}

// ─── WebSocket Message Handlers ──────────────────────────────────────

function handleWSMessage(message: InferenceWSMessage): void {
  const store = useStreamIOInferenceStore.getState();

  switch (message.type) {
    case 'chat_token':
      handleChatToken(message.agentId, message.messageId, message.token);
      break;

    case 'chat_complete':
      handleChatComplete(message.agentId, message.messageId, message.content);
      break;

    case 'annotations':
      handleAnnotations(message.agentId, message.frameId, message.annotations);
      break;

    case 'agent_status':
      store.setAgentStatus(message.agentId, message.status);
      break;

    case 'cost_update':
      store.updateBudget({
        tokensUsed: message.totalTokens,
        estimatedCost: message.estimatedCost,
        budgetRemaining: message.budgetRemaining,
      });
      break;
  }
}

function handleChatToken(agentId: string, messageId: string, token: string): void {
  const store = useStreamIOInferenceStore.getState();
  const existing = store.chatMessages.find((m) => m.id === messageId);

  if (existing) {
    store.appendChatToken(messageId, token);
  } else {
    // First token — create message
    const agent = getAgentById(agentId);
    if (!agent) return;

    const message: InferenceChatMessage = {
      id: messageId,
      agentId,
      agentName: agent.name,
      agentColor: agent.color,
      agentIcon: agent.icon,
      content: token,
      isStreaming: true,
      isComplete: false,
      frameId: store.currentFrameId || '',
      timestamp: Date.now(),
      tokenCount: 1,
    };
    store.addChatMessage(message);
  }
}

function handleChatComplete(agentId: string, messageId: string, content: string): void {
  const store = useStreamIOInferenceStore.getState();
  store.updateChatMessage(messageId, {
    content,
    isStreaming: false,
    isComplete: true,
  });
  store.incrementAgentFrames(agentId);
  store.setAgentStatus(agentId, 'idle');
}

function handleAnnotations(agentId: string, frameId: string, annotations: Annotation[]): void {
  const store = useStreamIOInferenceStore.getState();
  const agent = getAgentById(agentId);

  // Apply agent color to annotations that don't have one
  const coloredAnnotations = annotations.map((a) => ({
    ...a,
    color: a.color || agent?.color || '#FFFFFF',
  }));

  const frame: AnnotationFrame = {
    frameId,
    timestamp: Date.now(),
    agentId,
    annotations: coloredAnnotations,
  };

  store.setAnnotations(agentId, frame);
  store.incrementAgentFrames(agentId);
  store.setAgentStatus(agentId, 'idle');
}

// ─── Budget Exceeded Handler ─────────────────────────────────────────

function handleBudgetExceeded(): void {
  const action = getBudgetAction();

  switch (action) {
    case 'pause':
      pauseInference();
      break;

    case 'degrade':
      // Already handled by adaptive throttling — but if we're here,
      // throttling wasn't enough. Disable lowest-priority agents.
      degradeAgents();
      break;

    case 'stop':
      stopInference();
      break;
  }
}

function degradeAgents(): void {
  const store = useStreamIOInferenceStore.getState();
  const agentIds = Object.keys(store.agentStates);

  // Sort by priority (low first) and disable the lowest
  const agents = agentIds
    .map((id) => ({ id, agent: getAgentById(id) }))
    .filter((a) => a.agent !== undefined)
    .sort((a, b) => (a.agent!.priority - b.agent!.priority));

  if (agents.length > 1) {
    const toDisable = agents[0];
    store.setAgentStatus(toDisable.id, 'rate_limited');
    console.warn(`Budget degradation: disabled agent "${toDisable.agent!.name}"`);
  }
}

// ─── Viewer Toggle Commands ──────────────────────────────────────────

export function toggleAgent(agentId: string, enabled: boolean): void {
  sendWSCommand({ type: 'toggle_agent', agentId, enabled });
}

// ─── Status Helpers ──────────────────────────────────────────────────

export function isInferenceActive(): boolean {
  return useStreamIOInferenceStore.getState().status === 'active';
}

export function isWebSocketConnected(): boolean {
  return socket?.connected ?? false;
}
