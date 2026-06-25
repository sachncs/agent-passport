import { processMemoryUsageBytes, processUptimeSeconds } from './metrics';

const COLLECT_INTERVAL_MS = 15_000;

let collectTimer: NodeJS.Timeout | null = null;
let startedAt = Date.now();

function collectMemory(): void {
  const mem = process.memoryUsage();
  processMemoryUsageBytes.set({ type: 'rss' }, mem.rss);
  processMemoryUsageBytes.set({ type: 'heapTotal' }, mem.heapTotal);
  processMemoryUsageBytes.set({ type: 'heapUsed' }, mem.heapUsed);
  processMemoryUsageBytes.set({ type: 'external' }, mem.external);
  processMemoryUsageBytes.set({ type: 'arrayBuffers' }, mem.arrayBuffers);
}

function collectUptime(): void {
  processUptimeSeconds.set({}, Math.floor((Date.now() - startedAt) / 1000));
}

export function startMetricsCollectors(): void {
  if (collectTimer) return;
  startedAt = Date.now();
  collectMemory();
  collectUptime();
  collectTimer = setInterval(() => {
    collectMemory();
    collectUptime();
  }, COLLECT_INTERVAL_MS);
  collectTimer.unref?.();
}

export function stopMetricsCollectors(): void {
  if (collectTimer) {
    clearInterval(collectTimer);
    collectTimer = null;
  }
}
