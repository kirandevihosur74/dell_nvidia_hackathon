// Inference budget service — cost tracking, rate limiting, adaptive throttling
//
// Tracks per-stream token usage and estimated cost against configurable budgets.
// Implements adaptive throttling: as budget is consumed, frame sampling rate
// decreases and low-priority agents are disabled.

import {
  StreamBudget,
  BudgetAction,
  BudgetTier,
  BudgetTierConfig,
} from '@/types/streamio/inference';

export type { BudgetTier };
import { useStreamIOInferenceStore } from '@/stores/streamio/inferenceStore';

// ─── Tier Configs ────────────────────────────────────────────────────

const TIER_CONFIGS: Record<BudgetTier, BudgetTierConfig> = {
  free: {
    requestsPerMinute: 5,
    tokensPerStream: 10_000,
    estimatedCostPerStream: 0.01,
  },
  pro: {
    requestsPerMinute: 15,
    tokensPerStream: 100_000,
    estimatedCostPerStream: 0.10,
  },
  enterprise: {
    requestsPerMinute: 60,
    tokensPerStream: 1_000_000,
    estimatedCostPerStream: 1.00,
  },
};

// ─── Gemini Pricing (approximate) ────────────────────────────────────

const PRICING = {
  'gemini-2.0-flash': {
    inputPerMillionTokens: 0.10,
    outputPerMillionTokens: 0.40,
    imageTokensPerFrame: 258, // 720p JPEG
  },
  'gemini-2.0-pro': {
    inputPerMillionTokens: 1.25,
    outputPerMillionTokens: 5.00,
    imageTokensPerFrame: 258,
  },
};

// ─── Budget State ────────────────────────────────────────────────────

let activeBudget: StreamBudget | null = null;
let requestTimestamps: number[] = []; // sliding window for rate limiting

// ─── Public API ──────────────────────────────────────────────────────

export function getTierConfig(tier: BudgetTier): BudgetTierConfig {
  return TIER_CONFIGS[tier];
}

export function initBudget(streamId: string, tier: BudgetTier, overrides?: Partial<StreamBudget>): StreamBudget {
  const tierConfig = TIER_CONFIGS[tier];

  activeBudget = {
    streamId,
    maxTokensPerStream: tierConfig.tokensPerStream,
    maxCostPerStream: tierConfig.estimatedCostPerStream,
    maxRequestsPerMinute: tierConfig.requestsPerMinute,
    tokensUsed: 0,
    estimatedCost: 0,
    requestsThisMinute: 0,
    onBudgetExceeded: 'degrade',
    ...overrides,
  };

  requestTimestamps = [];
  return activeBudget;
}

export function getBudget(): StreamBudget | null {
  return activeBudget;
}

export function resetBudget(): void {
  activeBudget = null;
  requestTimestamps = [];
}

// ─── Usage Tracking ──────────────────────────────────────────────────

export function recordUsage(
  model: 'gemini-2.0-flash' | 'gemini-2.0-pro',
  inputTokens: number,
  outputTokens: number,
): void {
  if (!activeBudget) return;

  const pricing = PRICING[model];
  const totalTokens = inputTokens + outputTokens;
  const cost =
    (inputTokens / 1_000_000) * pricing.inputPerMillionTokens +
    (outputTokens / 1_000_000) * pricing.outputPerMillionTokens;

  activeBudget.tokensUsed += totalTokens;
  activeBudget.estimatedCost += cost;

  // Update sliding window
  const now = Date.now();
  requestTimestamps.push(now);
  pruneRequestWindow(now);
  activeBudget.requestsThisMinute = requestTimestamps.length;

  // Push to store for UI reactivity
  useStreamIOInferenceStore.getState().updateBudget({
    tokensUsed: activeBudget.tokensUsed,
    estimatedCost: activeBudget.estimatedCost,
    requestsThisMinute: activeBudget.requestsThisMinute,
    budgetRemaining: activeBudget.maxCostPerStream - activeBudget.estimatedCost,
  });
}

export function estimateFrameCost(
  model: 'gemini-2.0-flash' | 'gemini-2.0-pro',
  promptTokens: number,
  expectedOutputTokens: number,
): number {
  const pricing = PRICING[model];
  const inputTokens = pricing.imageTokensPerFrame + promptTokens;
  return (
    (inputTokens / 1_000_000) * pricing.inputPerMillionTokens +
    (expectedOutputTokens / 1_000_000) * pricing.outputPerMillionTokens
  );
}

// ─── Rate Limiting ───────────────────────────────────────────────────

function pruneRequestWindow(now: number): void {
  const oneMinuteAgo = now - 60_000;
  requestTimestamps = requestTimestamps.filter((t) => t > oneMinuteAgo);
}

export function canMakeRequest(): boolean {
  if (!activeBudget) return false;

  pruneRequestWindow(Date.now());
  return requestTimestamps.length < activeBudget.maxRequestsPerMinute;
}

export function isRateLimited(): boolean {
  return !canMakeRequest();
}

// ─── Budget Threshold Checks ─────────────────────────────────────────

export type ThrottleLevel = 'none' | 'light' | 'heavy' | 'exceeded';

export function getThrottleLevel(): ThrottleLevel {
  if (!activeBudget) return 'none';

  const costRatio = activeBudget.estimatedCost / activeBudget.maxCostPerStream;
  const tokenRatio = activeBudget.tokensUsed / activeBudget.maxTokensPerStream;
  const maxRatio = Math.max(costRatio, tokenRatio);

  if (maxRatio >= 1.0) return 'exceeded';
  if (maxRatio >= 0.9) return 'heavy';
  if (maxRatio >= 0.75) return 'light';
  return 'none';
}

export function getRecommendedIntervalMs(): number {
  const level = getThrottleLevel();
  switch (level) {
    case 'none': return 3000;    // default: every 3s
    case 'light': return 6000;   // 75% budget: every 6s
    case 'heavy': return 12000;  // 90% budget: every 12s
    case 'exceeded': return -1;  // stop inference
  }
}

export function getBudgetAction(): BudgetAction | null {
  if (!activeBudget) return null;
  if (getThrottleLevel() === 'exceeded') {
    return activeBudget.onBudgetExceeded;
  }
  return null;
}

export function getBudgetPercentage(): number {
  if (!activeBudget) return 0;
  const costRatio = activeBudget.estimatedCost / activeBudget.maxCostPerStream;
  const tokenRatio = activeBudget.tokensUsed / activeBudget.maxTokensPerStream;
  return Math.min(Math.max(costRatio, tokenRatio) * 100, 100);
}

// ─── Gemini 429 Backoff ──────────────────────────────────────────────

let backoffDelayMs = 0;
let backoffRetries = 0;
const MAX_BACKOFF_RETRIES = 3;
const BASE_BACKOFF_MS = 2000;

export function onRateLimitResponse(): number {
  backoffRetries++;
  if (backoffRetries > MAX_BACKOFF_RETRIES) {
    backoffDelayMs = -1; // signal to stop retrying
    return -1;
  }
  backoffDelayMs = BASE_BACKOFF_MS * Math.pow(2, backoffRetries - 1); // 2s, 4s, 8s
  return backoffDelayMs;
}

export function getBackoffDelay(): number {
  return backoffDelayMs;
}

export function resetBackoff(): void {
  backoffDelayMs = 0;
  backoffRetries = 0;
}

export function isBackedOff(): boolean {
  return backoffDelayMs > 0;
}
