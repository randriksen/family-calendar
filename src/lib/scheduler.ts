import { getSetting } from './db';
import { refreshAllSources } from './ical';

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

async function runRefresh() {
  if (isRunning) return;
  isRunning = true;
  try {
    console.log('[scheduler] Starting calendar refresh...');
    const result = await refreshAllSources();
    console.log(`[scheduler] Refresh complete: ${result.total} events, ${result.errors} errors`);
  } catch (err) {
    console.error('[scheduler] Refresh failed:', err);
  } finally {
    isRunning = false;
  }
}

export function startScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  const intervalMinutes = parseInt(getSetting('refresh_interval_minutes') || '60', 10);
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[scheduler] Starting with ${intervalMinutes}-minute interval`);

  // Run immediately on startup
  runRefresh();

  schedulerInterval = setInterval(() => {
    runRefresh();
  }, intervalMs);
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
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
