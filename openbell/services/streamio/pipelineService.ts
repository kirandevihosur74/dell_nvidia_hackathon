// Pipeline service — manages agent pipeline configurations
//
// Supports three topologies:
//   1. Parallel: All agents in a stage run concurrently on the same frame
//   2. Sequential: Stages execute in order, each receiving prior stage context
//   3. Hybrid: Mix of parallel stages chained together
//
// Pipeline configs are persisted locally (AsyncStorage) and synced to server.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { PipelineConfig, PipelineStage, AgentInputType } from '@/types/streamio/inference';
import { streamIOApiClient } from '@/services/streamio/apiClient';
import { getAgentById } from './agentRegistry';

const STORAGE_KEY = 'streamio:pipelines';

let pipelines: PipelineConfig[] = [];
let activePipelineId: string | null = null;

// ─── CRUD ────────────────────────────────────────────────────────────

export function getPipelines(): PipelineConfig[] {
  return [...pipelines];
}

export function getPipelineById(id: string): PipelineConfig | undefined {
  return pipelines.find((p) => p.id === id);
}

export function getActivePipeline(): PipelineConfig | undefined {
  if (!activePipelineId) return undefined;
  return getPipelineById(activePipelineId);
}

export function setActivePipelineId(id: string | null): void {
  activePipelineId = id;
}

export function getActivePipelineId(): string | null {
  return activePipelineId;
}

export function createPipeline(name: string, stages: PipelineStage[]): PipelineConfig {
  const now = new Date().toISOString();
  const pipeline: PipelineConfig = {
    id: `pipeline_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    stages: stages.map((s, i) => ({ ...s, stageIndex: i })),
    createdAt: now,
    updatedAt: now,
  };
  pipelines.push(pipeline);
  persistLocally();
  return pipeline;
}

export function updatePipeline(id: string, updates: Partial<Pick<PipelineConfig, 'name' | 'stages'>>): boolean {
  const index = pipelines.findIndex((p) => p.id === id);
  if (index === -1) return false;

  if (updates.stages) {
    updates.stages = updates.stages.map((s, i) => ({ ...s, stageIndex: i }));
  }

  pipelines[index] = {
    ...pipelines[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  persistLocally();
  return true;
}

export function deletePipeline(id: string): boolean {
  const before = pipelines.length;
  pipelines = pipelines.filter((p) => p.id !== id);
  if (activePipelineId === id) activePipelineId = null;
  persistLocally();
  return pipelines.length < before;
}

/** Returns the set of inputTypes needed by all agents in the active pipeline. */
export function getActivePipelineAgentInputTypes(): Set<AgentInputType> {
  const types = new Set<AgentInputType>();
  const pipeline = getActivePipeline();
  if (!pipeline) return types;

  for (const stage of pipeline.stages) {
    for (const agentId of stage.agents) {
      const agent = getAgentById(agentId);
      if (agent) types.add(agent.inputType);
    }
  }
  return types;
}

// ─── Pipeline Execution Plan ─────────────────────────────────────────

export interface ExecutionPlan {
  stages: ExecutionStage[];
  totalAgents: number;
  estimatedLatencyMs: number;
}

export interface ExecutionStage {
  stageIndex: number;
  agentIds: string[];
  parallel: boolean;
  passContextToNext: boolean;
}

export function buildExecutionPlan(pipeline: PipelineConfig): ExecutionPlan {
  const stages: ExecutionStage[] = pipeline.stages.map((stage) => ({
    stageIndex: stage.stageIndex,
    agentIds: stage.agents.filter((id) => getAgentById(id) !== undefined),
    parallel: stage.agents.length > 1,
    passContextToNext: stage.passContextToNext,
  }));

  const totalAgents = stages.reduce((sum, s) => sum + s.agentIds.length, 0);

  // Estimate: parallel stages ~2s, sequential adds ~2s per stage
  const parallelStages = stages.filter((s) => s.parallel).length;
  const sequentialStages = stages.length - parallelStages;
  const estimatedLatencyMs = Math.max(parallelStages, 1) * 2000 + sequentialStages * 2000;

  return { stages, totalAgents, estimatedLatencyMs };
}

// ─── Quick Pipeline Builders ─────────────────────────────────────────

export function createParallelPipeline(name: string, agentIds: string[]): PipelineConfig {
  return createPipeline(name, [
    {
      stageIndex: 0,
      agents: agentIds,
      mergeStrategy: 'concat',
      passContextToNext: false,
    },
  ]);
}

export function createChainPipeline(name: string, agentIds: string[]): PipelineConfig {
  const stages: PipelineStage[] = agentIds.map((id, i) => ({
    stageIndex: i,
    agents: [id],
    mergeStrategy: 'concat',
    passContextToNext: i < agentIds.length - 1,
  }));
  return createPipeline(name, stages);
}

export function createHybridPipeline(
  name: string,
  parallelAgentIds: string[],
  chainAgentIds: string[],
): PipelineConfig {
  const stages: PipelineStage[] = [
    {
      stageIndex: 0,
      agents: parallelAgentIds,
      mergeStrategy: 'concat',
      passContextToNext: chainAgentIds.length > 0,
    },
    ...chainAgentIds.map((id, i) => ({
      stageIndex: i + 1,
      agents: [id],
      mergeStrategy: 'concat' as const,
      passContextToNext: i < chainAgentIds.length - 1,
    })),
  ];
  return createPipeline(name, stages);
}

// ─── Stage Reordering ────────────────────────────────────────────────

export function moveStage(pipelineId: string, fromIndex: number, toIndex: number): boolean {
  const pipeline = getPipelineById(pipelineId);
  if (!pipeline) return false;
  if (fromIndex < 0 || fromIndex >= pipeline.stages.length) return false;
  if (toIndex < 0 || toIndex >= pipeline.stages.length) return false;

  const stages = [...pipeline.stages];
  const [moved] = stages.splice(fromIndex, 1);
  stages.splice(toIndex, 0, moved);

  return updatePipeline(pipelineId, { stages });
}

export function addAgentToStage(pipelineId: string, stageIndex: number, agentId: string): boolean {
  const pipeline = getPipelineById(pipelineId);
  if (!pipeline) return false;

  const stages = [...pipeline.stages];
  if (stageIndex >= stages.length) {
    // Create new stage
    stages.push({
      stageIndex: stages.length,
      agents: [agentId],
      mergeStrategy: 'concat',
      passContextToNext: false,
    });
  } else {
    stages[stageIndex] = {
      ...stages[stageIndex],
      agents: [...stages[stageIndex].agents, agentId],
    };
  }

  return updatePipeline(pipelineId, { stages });
}

export function removeAgentFromStage(pipelineId: string, stageIndex: number, agentId: string): boolean {
  const pipeline = getPipelineById(pipelineId);
  if (!pipeline || stageIndex >= pipeline.stages.length) return false;

  const stages = [...pipeline.stages];
  stages[stageIndex] = {
    ...stages[stageIndex],
    agents: stages[stageIndex].agents.filter((id) => id !== agentId),
  };

  // Remove empty stages
  const filtered = stages.filter((s) => s.agents.length > 0);
  return updatePipeline(pipelineId, { stages: filtered });
}

// ─── Validation ──────────────────────────────────────────────────────

export function validatePipeline(pipeline: PipelineConfig): string[] {
  const errors: string[] = [];

  if (!pipeline.name?.trim()) errors.push('Pipeline name is required');
  if (pipeline.stages.length === 0) errors.push('Pipeline must have at least one stage');

  for (const stage of pipeline.stages) {
    if (stage.agents.length === 0) {
      errors.push(`Stage ${stage.stageIndex} has no agents`);
    }
    for (const agentId of stage.agents) {
      if (!getAgentById(agentId)) {
        errors.push(`Agent "${agentId}" not found in stage ${stage.stageIndex}`);
      }
    }
  }

  // Check that chained agents accept context
  for (let i = 1; i < pipeline.stages.length; i++) {
    if (pipeline.stages[i - 1].passContextToNext) {
      for (const agentId of pipeline.stages[i].agents) {
        const agent = getAgentById(agentId);
        if (agent && agent.inputType !== 'frame+context') {
          errors.push(`Agent "${agent.name}" in stage ${i} does not accept context but previous stage passes it`);
        }
      }
    }
  }

  return errors;
}

// ─── Local Persistence ───────────────────────────────────────────────

async function persistLocally(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ pipelines, activePipelineId }));
  } catch {
    // Storage full or unavailable
  }
}

export async function loadFromStorage(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      pipelines = data.pipelines || [];
      activePipelineId = data.activePipelineId || null;
    }
  } catch {
    // Corrupted data — start fresh
    pipelines = [];
    activePipelineId = null;
  }
}

// ─── Server Sync ─────────────────────────────────────────────────────

export async function fetchPipelinesFromServer(): Promise<void> {
  try {
    const serverPipelines = await streamIOApiClient.get<PipelineConfig[]>('/api/v1/inference/pipelines');
    pipelines = serverPipelines;
    await persistLocally();
  } catch {
    // Use local data
  }
}

export async function syncPipelineToServer(pipeline: PipelineConfig): Promise<void> {
  try {
    await streamIOApiClient.post('/api/v1/inference/pipelines', pipeline);
  } catch {
    // Best effort
  }
}
