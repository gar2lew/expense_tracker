import { describe, it, expect, vi, afterEach } from 'vitest';
import { withRetry } from './retry';

describe('withRetry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('succeeds on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { initialDelayMs: 0 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 503 and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('503 unavailable'), { status: 503 }))
      .mockResolvedValueOnce('success');

    const result = await withRetry(fn, { initialDelayMs: 0, maxRetries: 3 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on 500 and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('500 internal'), { status: 500 }))
      .mockResolvedValueOnce('ok');

    const result = await withRetry(fn, { initialDelayMs: 0, maxRetries: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on transient errors (502, 504) and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('502'), { status: 502 }))
      .mockRejectedValueOnce(Object.assign(new Error('504'), { status: 504 }))
      .mockResolvedValueOnce('done');

    const result = await withRetry(fn, { initialDelayMs: 0, maxRetries: 3 });
    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('exhausts retries and throws last error', async () => {
    const lastError = Object.assign(new Error('503 final'), { status: 503 });
    const fn = vi.fn().mockRejectedValue(lastError);

    await expect(withRetry(fn, { initialDelayMs: 0, maxRetries: 2 })).rejects.toThrow('503 final');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry on 400 BAD_REQUEST', async () => {
    const error = Object.assign(new Error('bad request'), { status: 400 });
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn)).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on API key error', async () => {
    const error = new Error('API_KEY_INVALID: key not found');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn)).rejects.toThrow('API_KEY_INVALID');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on malformed requests', async () => {
    const error = Object.assign(new Error('Invalid content type'), { status: 400 });
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn)).rejects.toThrow('Invalid content type');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry callback on each transient failure', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('503'), { status: 503 }))
      .mockRejectedValueOnce(Object.assign(new Error('503'), { status: 503 }))
      .mockResolvedValueOnce('ok');

    const result = await withRetry(fn, { initialDelayMs: 0, maxRetries: 3, onRetry });
    expect(result).toBe('ok');
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respects maxRetries option', async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('503'), { status: 503 }));

    await expect(withRetry(fn, { initialDelayMs: 0, maxRetries: 1 })).rejects.toThrow('503');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('detects transient errors from message text', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('This model is currently experiencing high demand'))
      .mockResolvedValueOnce('success');

    const result = await withRetry(fn, { initialDelayMs: 0, maxRetries: 3 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('treats 429 as transient and retries', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('rate limited'), { status: 429 }))
      .mockResolvedValueOnce('ok');

    const result = await withRetry(fn, { initialDelayMs: 0, maxRetries: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('preserves status code for callers after exhaustion', async () => {
    const error429 = Object.assign(new Error('quota exceeded'), { status: 429 });
    const fn429 = vi.fn().mockRejectedValue(error429);
    await expect(withRetry(fn429, { initialDelayMs: 0, maxRetries: 1 })).rejects.toBe(error429);
    expect(fn429).toHaveBeenCalledTimes(2);

    const error503 = Object.assign(new Error('service unavailable'), { status: 503 });
    const fn503 = vi.fn().mockRejectedValue(error503);
    await expect(withRetry(fn503, { initialDelayMs: 0, maxRetries: 1 })).rejects.toBe(error503);
    expect(fn503).toHaveBeenCalledTimes(2);
  });
});
