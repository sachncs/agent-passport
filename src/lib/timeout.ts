const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Promise.race-based timeout for algosdk and other callables that don't
 * accept an AbortSignal. The inner promise is NOT cancelled on timeout —
 * algosdk has no AbortSignal hook, so any in-flight request continues
 * server-side and resolves to an unused result. Switch to
 * `fetch(url, { signal: AbortSignal.timeout(ms) })` for fetch-based ops.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms = DEFAULT_TIMEOUT_MS,
  label?: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout after ${ms}ms${label ? `: ${label}` : ''}`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/** Native equivalent of fetchWithTimeout — prefer this in new code. */
export async function fetchWithTimeout(
  url: string,
  options?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options ?? {};
  // Ponytail: AbortSignal.timeout() is the stdlib way. The extra
  // AbortController dance below is kept for callers that need to attach
  // additional abort
  // reasons (rare).
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
