const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

const INITIAL_DELAY_MS = 1000;
const MAX_RETRIES = 3;

function isTransientError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const e = error as Record<string, unknown>;
    const status = e.status ?? e.code;
    if (typeof status === 'number' && TRANSIENT_STATUSES.has(status)) return true;
    if (typeof status === 'string' && TRANSIENT_STATUSES.has(Number(status))) return true;
    const message = typeof e.message === 'string' ? e.message.toLowerCase() : '';
    if (message.includes('503') || message.includes('unavailable') || message.includes('overloaded') || message.includes('high demand')) return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(baseMs: number): number {
  return baseMs + Math.floor(Math.random() * baseMs * 0.3);
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const initialDelay = options.initialDelayMs ?? INITIAL_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !isTransientError(error)) {
        throw error;
      }

      const delay = jitter(initialDelay * Math.pow(2, attempt));
      options.onRetry?.(attempt + 1, delay, error);
      await sleep(delay);
    }
  }

  throw lastError;
}
