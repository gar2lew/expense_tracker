import express from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { withRetry } from './src/lib/retry.js';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const PRIMARY_MODEL = 'gemini-3.5-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';

const RECEIPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    date: {
      type: Type.STRING,
      description: 'Transaction date strictly formatted as YYYY-MM-DD. Current year is 2026.',
    },
    vendor: {
      type: Type.STRING,
      description: 'Clean formatted merchant or vendor name.',
    },
    totalAmount: {
      type: Type.NUMBER,
      description: 'Final absolute total payment amount as a decimal number.',
    },
    currency: {
      type: Type.STRING,
      description: 'ISO 3-Letter currency code. Default to AUD if ambiguous.',
    },
    category: {
      type: Type.STRING,
      description: 'One of: "Food & Dining", "Supplies", "Travel", "Utilities", "Retail", "Subscriptions", "Entertainment", "Other"',
    },
    description: {
      type: Type.STRING,
      description: 'Brief 1-sentence listing of main items.',
    },
  },
  required: ['date', 'vendor', 'totalAmount', 'currency', 'category', 'description'],
} as const;

function jsonError(res: express.Response, status: number, message: string, code: string, retryable: boolean) {
  return res.status(status).json({ error: message, code, retryable });
}

async function callGemini(model: string, imageBytes: string, mimeType: string) {
  const imagePart = {
    inlineData: { data: imageBytes, mimeType: mimeType || 'image/jpeg' },
  };

  const promptText =
    'You are an expert receipt parsing AI. Analyze the uploaded receipt image and extract the requested fields. Ensure accuracy in decimal amounts, dates, and currency detection. The current year context is 2026.';

  const response = await ai.models.generateContent({
    model,
    contents: [imagePart, { text: promptText }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: RECEIPT_SCHEMA,
    },
  });

  const parsedText = response.text;
  if (!parsedText) {
    throw Object.assign(new Error('Gemini returned empty text response'), { status: 500 });
  }

  return JSON.parse(parsedText.trim());
}

app.post('/api/parse-receipt', async (req, res) => {
  try {
    const { imageBytes, mimeType } = req.body;

    if (!imageBytes) {
      return jsonError(res, 400, 'No image bytes provided in the request.', 'INVALID_INPUT', false);
    }

    if (!process.env.GEMINI_API_KEY) {
      return jsonError(res, 500, 'Server is not configured for AI processing.', 'GEMINI_NOT_CONFIGURED', false);
    }

    const trimmedBytes = typeof imageBytes === 'string' ? imageBytes.trim() : imageBytes;
    const trimmedMime = typeof mimeType === 'string' ? mimeType.trim() : 'image/jpeg';

    const result = await withRetry(
      () => callGemini(PRIMARY_MODEL, trimmedBytes, trimmedMime),
      {
        maxRetries: 3,
        initialDelayMs: 1000,
        onRetry: (attempt, delayMs, err) => {
          console.log(`Gemini parse-receipt: retry ${attempt}/3 in ${delayMs}ms (${err instanceof Error ? err.message : String(err)})`);
        },
      }
    ).catch(async (primaryError) => {
      if (!isTransientError(primaryError)) throw primaryError;

      console.log('Gemini parse-receipt: primary model exhausted, attempting fallback model');
      try {
        return await callGemini(FALLBACK_MODEL, trimmedBytes, trimmedMime);
      } catch {
        throw primaryError;
      }
    });

    return res.json(result);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.log('Gemini parse-receipt failed:', message.replace(/(\r\n|\n|\r)/g, ' ').substring(0, 200));

    if (isTransientError(error)) {
      if (getStatusCode(error) === 429) {
        return jsonError(res, 429, 'Receipt scanning has reached its temporary usage limit. Please try again shortly.', 'GEMINI_RATE_LIMITED', true);
      }
      return jsonError(res, 503, 'Receipt scanning is temporarily busy. Please try again shortly.', 'GEMINI_TEMPORARILY_UNAVAILABLE', true);
    }

    if (message.includes('API key') || message.includes('API_KEY_INVALID') || message.includes('permission')) {
      return jsonError(res, 500, 'AI service configuration error.', 'GEMINI_CONFIG_ERROR', false);
    }

    if (message.includes('Invalid JSON') || message.includes('JSON.parse') || message.includes('empty text')) {
      return jsonError(res, 500, 'Receipt scanning produced an unreadable result. Please try a different photo.', 'GEMINI_PARSE_ERROR', true);
    }

    return jsonError(res, 500, 'An unexpected error occurred during receipt scanning.', 'INTERNAL_ERROR', false);
  }
});

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
  if (typeof status === 'string') {
    const n = Number(status);
    return isNaN(n) ? null : n;
  }
  return null;
}

app.post('/api/analyze-expenses', async (req, res) => {
  try {
    const { expenses } = req.body;

    if (!expenses || !Array.isArray(expenses)) {
      return jsonError(res, 400, 'Expenses list is missing or invalid.', 'INVALID_INPUT', false);
    }

    if (!process.env.GEMINI_API_KEY) {
      return jsonError(res, 500, 'Server is not configured for AI processing.', 'GEMINI_NOT_CONFIGURED', false);
    }

    const todayDate = new Date().toISOString().split('T')[0];

    const promptText = [
      'You are a financial strategist AI. Analyze the uploaded expense records.',
      `Current date: ${todayDate}.`,
      'All monetary values are in AUD.',
      `Expenses: ${JSON.stringify(expenses)}`,
      'Provide: spending summary, patterns, anomalies, recommendations, and burn-rate forecast.',
    ].join('\n');

    const result = await withRetry(
      async () => {
        const response = await ai.models.generateContent({
          model: PRIMARY_MODEL,
          contents: promptText,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING, description: 'Executive summary of spending habits.' },
                patterns: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      iconType: { type: Type.STRING },
                      impact: { type: Type.STRING },
                    },
                    required: ['title', 'description', 'iconType', 'impact'],
                  },
                },
                anomalies: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      badge: { type: Type.STRING },
                    },
                    required: ['title', 'description', 'badge'],
                  },
                },
                recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
                burnRate: {
                  type: Type.OBJECT,
                  properties: {
                    averageMonthly: { type: Type.STRING },
                    forecastNextMonth: { type: Type.STRING },
                    confidence: { type: Type.STRING },
                  },
                  required: ['averageMonthly', 'forecastNextMonth', 'confidence'],
                },
              },
              required: ['summary', 'patterns', 'anomalies', 'recommendations', 'burnRate'],
            },
          },
        });

        const parsedText = response.text;
        if (!parsedText) throw Object.assign(new Error('Empty response'), { status: 500 });
        return JSON.parse(parsedText.trim());
      },
      {
        maxRetries: 2,
        initialDelayMs: 1000,
        onRetry: (attempt, delayMs, _err) => {
          console.log(`Gemini analyze: retry ${attempt}/2 in ${delayMs}ms`);
        },
      }
    );

    return res.json(result);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.log('Gemini analyze failed:', message.replace(/(\r\n|\n|\r)/g, ' ').substring(0, 200));

    if (isTransientError(error)) {
      if (getStatusCode(error) === 429) {
        return jsonError(res, 429, 'Analysis has reached its temporary usage limit. Please try again shortly.', 'GEMINI_RATE_LIMITED', true);
      }
      return jsonError(res, 503, 'Analysis is temporarily busy. Please try again shortly.', 'GEMINI_TEMPORARILY_UNAVAILABLE', true);
    }

    return jsonError(res, 500, 'An unexpected error occurred during analysis.', 'INTERNAL_ERROR', false);
  }
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server launched on port ${PORT}`);
  });
}

start().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('Failed to start server:', message);
});
