import { compressAndToBase64 } from './utils';
import { Expense } from './db';

export interface ReceiptData {
  date: string; // YYYY-MM-DD
  vendor: string;
  totalAmount: number;
  currency: string;
  category: string;
  description: string;
}

export interface ExpenseAnalysisResult {
  summary: string;
  patterns: Array<{
    title: string;
    description: string;
    iconType: 'trend-up' | 'trend-down' | 'caution' | 'info' | 'repeating';
    impact: string;
  }>;
  anomalies: Array<{
    title: string;
    description: string;
    badge: string;
  }>;
  recommendations: string[];
  burnRate: {
    averageMonthly: string;
    forecastNextMonth: string;
    confidence: string; // e.g. High, Medium, Low
  };
}

/**
 * Uploads a receipt image to the server-side API proxy for secure parsing with Gemini.
 */
export async function parseReceiptImage(file: File): Promise<ReceiptData> {
  // Compress the image before uploading to save bandwidth and speed up Gemini response
  const base64DataUrl = await compressAndToBase64(file, 1200, 0.8);
  
  // Extract pure base64 database content
  const commaIndex = base64DataUrl.indexOf(',');
  const base64Content = commaIndex !== -1 ? base64DataUrl.substring(commaIndex + 1) : base64DataUrl;
  
  // Detect original type from data url, fallback to image/jpeg
  let mimeType = 'image/jpeg';
  const mimeMatch = base64DataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,/);
  if (mimeMatch) {
    mimeType = mimeMatch[1];
  }

  const response = await fetch('/api/parse-receipt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBytes: base64Content,
      mimeType: mimeType,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to parse receipt with Gemini');
  }

  const parsedJson: unknown = await response.json();
  if (!isReceiptData(parsedJson)) {
    throw new Error('Invalid receipt data received from server');
  }
  return parsedJson;
}

function isReceiptData(data: unknown): data is ReceiptData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.date === 'string' &&
    typeof d.vendor === 'string' &&
    typeof d.totalAmount === 'number' &&
    typeof d.currency === 'string' &&
    typeof d.category === 'string' &&
    typeof d.description === 'string'
  );
}

/**
 * Sends non-image expense details to the server-side API proxy for trend analysis and anomaly detection.
 */
export async function analyzeExpenses(expenses: Expense[]): Promise<ExpenseAnalysisResult> {
  // Strip image base64 field to avoid overloading payload limits
  const cleanExpenses = expenses.map(({ id, date, vendor, totalAmount, currency, category, description }) => ({
    id,
    date,
    vendor,
    totalAmount,
    currency,
    category,
    description,
  }));

  const response = await fetch('/api/analyze-expenses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expenses: cleanExpenses }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to analyze expenses with Gemini');
  }

  const parsedJson: unknown = await response.json();
  if (!isExpenseAnalysisResult(parsedJson)) {
    throw new Error('Invalid analysis result received from server');
  }
  return parsedJson;
}

function isExpenseAnalysisResult(data: unknown): data is ExpenseAnalysisResult {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.summary === 'string' &&
    Array.isArray(d.patterns) &&
    Array.isArray(d.anomalies) &&
    Array.isArray(d.recommendations) &&
    typeof d.burnRate === 'object' &&
    d.burnRate !== null
  );
}
