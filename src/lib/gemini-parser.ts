import { GoogleGenAI, Type } from '@google/genai';
import { withRetry } from './retry.js';

const PRIMARY_MODEL = 'gemini-3.5-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export const RECEIPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    date: { type: Type.STRING, description: 'Transaction date strictly formatted as YYYY-MM-DD. Current year is 2026.' },
    vendor: { type: Type.STRING, description: 'Clean formatted merchant or vendor name.' },
    totalAmount: { type: Type.NUMBER, description: 'Final absolute total payment amount as a decimal number.' },
    currency: { type: Type.STRING, description: 'ISO 3-Letter currency code. Default to AUD if ambiguous.' },
    category: { type: Type.STRING, description: 'One of: "Food & Dining", "Supplies", "Travel", "Utilities", "Retail", "Subscriptions", "Entertainment", "Other"' },
    description: { type: Type.STRING, description: 'Brief 1-sentence listing of main items.' },
  },
  required: ['date', 'vendor', 'totalAmount', 'currency', 'category', 'description'],
} as const;

export interface ParseReceiptResult {
  date: string;
  vendor: string;
  totalAmount: number;
  currency: string;
  category: string;
  description: string;
}

export interface JsonErrorBody {
  error: string;
  code: string;
  retryable: boolean;
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return '';
  return key;
}

export function isConfigured(): boolean {
  return !!getApiKey();
}

function createGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: getApiKey(),
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

export async function parseReceipt(imageBytes: string, mimeType: string): Promise<ParseReceiptResult> {
  if (!imageBytes || imageBytes.trim().length === 0) {
    const err = new Error('No image bytes provided in the request.');
    (err as unknown as Record<string, unknown>).statusCode = 400;
    throw err;
  }

  if (imageBytes.length > MAX_IMAGE_BYTES) {
    const err = new Error('Uploaded image is too large. Maximum size is 25 MB.');
    (err as unknown as Record<string, unknown>).statusCode = 413;
    throw err;
  }

  if (!getApiKey()) {
    const err = new Error('Server is not configured for AI processing.');
    (err as unknown as Record<string, unknown>).statusCode = 500;
    throw err;
  }

  const ai = createGenAIClient();
  const trimmedBytes = imageBytes.trim();
  const trimmedMime = mimeType?.trim() || 'image/jpeg';

  const promptText = 'You are an expert receipt parsing AI. Analyze the uploaded receipt image and extract the requested fields. Ensure accuracy in decimal amounts, dates, and currency detection. The current year context is 2026.';

  const doCall = (model: string) =>
    ai.models.generateContent({
      model,
      contents: [{ inlineData: { data: trimmedBytes, mimeType: trimmedMime } }, { text: promptText }],
      config: { responseMimeType: 'application/json', responseSchema: RECEIPT_SCHEMA },
    });

  const response = await withRetry(
    () => doCall(PRIMARY_MODEL),
    {
      maxRetries: 3,
      initialDelayMs: 1000,
      onRetry: (attempt, delayMs, err) => {
        console.log(`Gemini: retry ${attempt}/3 in ${delayMs}ms (${err instanceof Error ? err.message.slice(0, 80) : String(err).slice(0, 80)})`);
      },
    }
  ).catch(async (primaryError) => {
    if (!isTransientError(primaryError)) throw primaryError;
    console.log('Gemini: primary model exhausted, attempting fallback');
    try { return await doCall(FALLBACK_MODEL); } catch { throw primaryError; }
  });

  const parsedText = response.text;
  if (!parsedText) {
    const err = new Error('Gemini returned empty text response.');
    (err as unknown as Record<string, unknown>).statusCode = 500;
    throw err;
  }

  return JSON.parse(parsedText.trim()) as ParseReceiptResult;
}

export function classifyError(error: unknown): { status: number; message: string; code: string; retryable: boolean } {
  const msg = error instanceof Error ? error.message : String(error);
  const statusCode = (error as Record<string, unknown>)?.statusCode as number | undefined;

  const isTransient = isTransientError(error);

  if (statusCode === 413) {
    return { status: 413, message: 'Uploaded image is too large. Maximum size is 25 MB.', code: 'IMAGE_TOO_LARGE', retryable: false };
  }

  if (statusCode === 400 || msg.includes('No image bytes')) {
    return { status: 400, message: 'No image bytes provided in the request.', code: 'INVALID_INPUT', retryable: false };
  }

  if (msg.includes('API key') || msg.includes('API_KEY_INVALID') || msg.includes('permission') || msg.includes('not configured')) {
    return { status: 500, message: 'AI service configuration error.', code: 'GEMINI_CONFIG_ERROR', retryable: false };
  }

  if (isTransient) {
    const sc = getStatusCode(error);
    if (sc === 429) {
      return { status: 429, message: 'Receipt scanning has reached its temporary usage limit. Please try again shortly.', code: 'GEMINI_RATE_LIMITED', retryable: true };
    }
    return { status: 503, message: 'Receipt scanning is temporarily busy. Please try again shortly.', code: 'GEMINI_TEMPORARILY_UNAVAILABLE', retryable: true };
  }

  if (msg.includes('Invalid JSON') || msg.includes('JSON.parse') || msg.includes('empty text')) {
    return { status: 500, message: 'Receipt scanning produced an unreadable result. Please try a different photo.', code: 'GEMINI_PARSE_ERROR', retryable: true };
  }

  return { status: 500, message: 'An unexpected error occurred during receipt scanning.', code: 'INTERNAL_ERROR', retryable: false };
}

function isTransientError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as Record<string, unknown>;
  const status = e.status ?? e.code;
  if (typeof status === 'number' && [429, 500, 502, 503, 504].includes(status)) return true;
  if (typeof status === 'string' && ['429', '500', '502', '503', '504'].includes(status)) return true;
  const msg = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  return msg.includes('503') || msg.includes('unavailable') || msg.includes('overloaded') || msg.includes('high demand');
}

function getStatusCode(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const e = error as Record<string, unknown>;
  const status = e.status ?? e.code;
  if (typeof status === 'number') return status;
  if (typeof status === 'string') { const n = Number(status); return isNaN(n) ? null : n; }
  return null;
}
