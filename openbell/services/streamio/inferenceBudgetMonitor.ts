// Inference budget monitor — watches budget state and fires warnings
//
// Runs on a 5-second interval during active inference. Checks throttle
// levels and emits warnings at 75% and 90% thresholds. Triggers the
// configured budget action when limit is exceeded.

import { useStreamIOInferenceStore } from '@/stores/streamio/inferenceStore';
import {
  getThrottleLevel,
  getBudgetPercentage,
  getBudgetAction,
  getRecommendedIntervalMs,
  getBudget,
  ThrottleLevel,
} from './inferenceBudget';

// Callbacks injected by inferenceService to break the require cycle
let _onPause: (() => void) | null = null;
let _onStop: (() => Promise<void>) | null = null;

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let lastWarningLevel: ThrottleLevel = 'none';

const MONITOR_INTERVAL_MS = 5000;

// ─── Lifecycle ───────────────────────────────────────────────────────

export function startBudgetMonitor(callbacks?: { onPause: () => void; onStop: () => Promise<void> }): void {
  if (monitorInterval) return;

  if (callbacks) {
    _onPause = callbacks.onPause;
    _onStop = callbacks.onStop;
  }

  lastWarningLevel = 'none';

  monitorInterval = setInterval(() => {
    checkBudget();
  }, MONITOR_INTERVAL_MS);
}

export function stopBudgetMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  lastWarningLevel = 'none';
}

// ─── Budget Check ────────────────────────────────────────────────────

function checkBudget(): void {
  const inferenceStatus = useStreamIOInferenceStore.getState().status;
  if (inferenceStatus !== 'active' && inferenceStatus !== 'paused') {
    stopBudgetMonitor();
    return;
  }

  const level = getThrottleLevel();
  const percentage = getBudgetPercentage();
  const budget = getBudget();

  // Only warn once per threshold crossing
  if (level !== lastWarningLevel) {
    switch (level) {
      case 'light':
        if (lastWarningLevel === 'none') {
          console.warn('[StreamIO]', `AI budget at ${Math.round(percentage)}% — frame rate reduced to every 6s`);
        }
        break;

      case 'heavy':
        console.warn('[StreamIO]', `AI budget at ${Math.round(percentage)}% — frame rate reduced to every 12s, low-priority agents may be disabled`);
        break;

      case 'exceeded':
        handleExceeded(budget?.onBudgetExceeded || 'degrade');
        break;
    }
    lastWarningLevel = level;
  }
}

function handleExceeded(action: string): void {
  switch (action) {
    case 'pause':
      console.warn('[StreamIO]', 'AI budget limit reached — inference paused');
      _onPause?.();
      break;

    case 'degrade':
      console.warn('[StreamIO]', 'AI budget limit reached — degrading to minimum agents');
      // inferenceService handles degradation internally
      break;

    case 'stop':
      console.warn('[StreamIO]', 'AI budget limit reached — inference stopped');
      _onStop?.();
      break;
  }
}

// ─── Status ──────────────────────────────────────────────────────────

export function isMonitorRunning(): boolean {
  return monitorInterval !== null;
}
