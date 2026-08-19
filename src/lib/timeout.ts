/**
 * Promise.race-based timeout for algosdk and other callables that don't
 * accept an AbortSignal. The inner promise is NOT cancelled on timeout —
 * algosdk has no AbortSignal hook, so any in-flight request continues
 * server-side and resolves to an unused result.
 *
 * For fetch-based calls, prefer the platform-native
 * `fetch(url, { signal: AbortSignal.timeout(ms) })`.
 */

const DEFAULT_TIMEOUT_MS = 10_000;

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = DEFAULT_TIMEOUT_MS,
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