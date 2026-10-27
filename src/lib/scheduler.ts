import { getSetting } from './db';
import { refreshDueSources } from './ical';

interface SchedulerState {
  interval: ReturnType<typeof setInterval> | null;
  isRunning: boolean;
}

// Next compiles instrumentation and route handlers as separate bundles, so this
// module can be instantiated more than once in a single process. Plain
// module-level state would diverge: restartScheduler() called from the settings
// API would not see the timer instrumentation started, so it would leave that
// timer running at the old interval and add a second one — leaking another
// timer on every change. Parking state on globalThis gives every instance of
// this module the same timer.
const STATE_KEY = '__familyCalendarSchedulerState';

function getState(): SchedulerState {
  const g = globalThis as Record<string, unknown>;
  if (!g[STATE_KEY]) {
    const initial: SchedulerState = { interval: null, isRunning: false };
    g[STATE_KEY] = initial;
  }
  return g[STATE_KEY] as SchedulerState;
}

async function runRefresh() {
  const state = getState();
  if (state.isRunning) return;
  state.isRunning = true;
  try {
    console.log('[scheduler] Checking for due calendar syncs...');
    const result = await refreshDueSources();
    console.log(`[scheduler] Sync check complete: ${result.total} events refreshed, ${result.skipped} up-to-date, ${result.errors} errors`);
  } catch (err) {
    console.error('[scheduler] Refresh failed:', err);
  } finally {
    state.isRunning = false;
  }
}

export function startScheduler() {
  const state = getState();
  if (state.interval) {
    clearInterval(state.interval);
    state.interval = null;
  }

  // The settings UI only offers 15..360, but the API accepts any string. A
  // NaN or 0 here would make setInterval fire continuously, so fall back.
  const parsed = parseInt(getSetting('refresh_interval_minutes') || '60', 10);
  const intervalMinutes = Number.isFinite(parsed) && parsed >= 1 ? parsed : 60;
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[scheduler] Starting with ${intervalMinutes}-minute interval`);

  // Run immediately on startup
  runRefresh();

  state.interval = setInterval(() => {
    runRefresh();
  }, intervalMs);
}

export function stopScheduler() {
  const state = getState();
  if (state.interval) {
    clearInterval(state.interval);
    state.interval = null;
    console.log('[scheduler] Stopped');
  }
}

export function restartScheduler() {
  stopScheduler();
  startScheduler();
}

// Allow triggering a manual refresh
export async function triggerRefresh() {
  return runRefresh();
}
