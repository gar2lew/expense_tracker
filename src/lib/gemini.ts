import { compressAndToBase64 } from './utils';

export interface ReceiptData {
  date: string;
  vendor: string;
  totalAmount: number;
  currency: string;
  category: string;
  description: string;
}

export async function parseReceiptImage(file: File): Promise<ReceiptData> {
  const base64DataUrl = await compressAndToBase64(file, 1200, 0.8);

  const commaIndex = base64DataUrl.indexOf(',');
  const base64Content = commaIndex !== -1 ? base64DataUrl.substring(commaIndex + 1) : base64DataUrl;

  let mimeType = 'image/jpeg';
  const mimeMatch = base64DataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,/);
  if (mimeMatch) {
    mimeType = mimeMatch[1];
  }

  const response = await fetch('/api/parse-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBytes: base64Content, mimeType }),
  });

  if (!response.ok) {
    let errorText = '';
    try {
      const errorJson = await response.json();
      errorText = errorJson?.error || errorText;
    } catch {
      errorText = await response.text();
    }
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
