import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock('../metrics', () => ({
  processMemoryUsageBytes: { set: vi.fn() },
  processUptimeSeconds: { set: vi.fn() },
}));

describe('metrics-collectors', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('collects memory and uptime immediately on start', async () => {
    const metrics = await import('../metrics');
    const { startMetricsCollectors, stopMetricsCollectors } = await import('../metrics-collectors');

    startMetricsCollectors();

    expect(metrics.processMemoryUsageBytes.set).toHaveBeenCalledTimes(5);
    expect(metrics.processUptimeSeconds.set).toHaveBeenCalledTimes(1);

    stopMetricsCollectors();
  });

  it('sets correct memory label types', async () => {
    const metrics = await import('../metrics');
    const { startMetricsCollectors, stopMetricsCollectors } = await import('../metrics-collectors');

    startMetricsCollectors();

    const labelCalls =
      metrics.processMemoryUsageBytes.set.mock.calls
        .map((c: unknown[]) => (c[0] as { type?: string })?.type);
    expect(labelCalls).toEqual(
      expect.arrayContaining(['rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers']),
    );

    stopMetricsCollectors();
  });

  it('is idempotent — second start does not create another interval', async () => {
    const metrics = await import('../metrics');
    const { startMetricsCollectors, stopMetricsCollectors } = await import('../metrics-collectors');

    startMetricsCollectors();
    const countAfterFirst =
      metrics.processMemoryUsageBytes.set.mock.calls.length;

    startMetricsCollectors();
    expect(
      metrics.processMemoryUsageBytes.set.mock.calls.length,
    ).toBe(countAfterFirst);

    stopMetricsCollectors();
  });

  it('collectors run on interval', async () => {
    const metrics = await import('../metrics');
    const { startMetricsCollectors, stopMetricsCollectors } = await import('../metrics-collectors');

    startMetricsCollectors();
    vi.clearAllMocks();

    vi.advanceTimersByTime(15_000);

    expect(metrics.processMemoryUsageBytes.set).toHaveBeenCalledTimes(5);
    expect(metrics.processUptimeSeconds.set).toHaveBeenCalledTimes(1);

    stopMetricsCollectors();
  });

  it('collectors run multiple intervals', async () => {
    const metrics = await import('../metrics');
    const { startMetricsCollectors, stopMetricsCollectors } = await import('../metrics-collectors');

    startMetricsCollectors();
    vi.clearAllMocks();

    vi.advanceTimersByTime(45_000);

    expect(metrics.processMemoryUsageBytes.set).toHaveBeenCalledTimes(15);
    expect(metrics.processUptimeSeconds.set).toHaveBeenCalledTimes(3);

    stopMetricsCollectors();
  });

  it('stopMetricsCollectors stops the interval', async () => {
    const metrics = await import('../metrics');
    const { startMetricsCollectors, stopMetricsCollectors } = await import('../metrics-collectors');

    startMetricsCollectors();
    stopMetricsCollectors();
    vi.clearAllMocks();

    vi.advanceTimersByTime(30_000);

    expect(metrics.processMemoryUsageBytes.set).not.toHaveBeenCalled();
    expect(metrics.processUptimeSeconds.set).not.toHaveBeenCalled();
  });

  it('stopMetricsCollectors is safe to call when not started', async () => {
    const { stopMetricsCollectors } = await import('../metrics-collectors');
    expect(() => stopMetricsCollectors()).not.toThrow();
  });

  it('sets uptime to seconds since start', async () => {
    const metrics = await import('../metrics');
    const { startMetricsCollectors, stopMetricsCollectors } = await import('../metrics-collectors');

    startMetricsCollectors();
    vi.clearAllMocks();

    vi.advanceTimersByTime(15_000);

    const uptimeCall = metrics.processUptimeSeconds.set.mock.calls[0];
    expect(uptimeCall[1]).toBeGreaterThanOrEqual(15);
    expect(uptimeCall[1]).toBeLessThanOrEqual(16);

    stopMetricsCollectors();
  });
});
