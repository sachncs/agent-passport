/**
 * Retry helper with exponential backoff and jitter.
 */

const DEFAULT_RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  retryableStatuses?: Set<number>;
  abortSignal?: AbortSignal;
  onRetry?: (attempt: number, error: Error) => void;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function computeBackoff(attempt: number, baseDelay: number): number {
  // Exponential backoff with 50% jitter
  const exponential = baseDelay * Math.pow(2, attempt);
  const jitter = exponential * 0.5 * Math.random();
  return Math.floor(exponential + jitter);
}

export function isRetryableStatus(status: number, allowed: Set<number>): boolean {
  return allowed.has(status);
}
