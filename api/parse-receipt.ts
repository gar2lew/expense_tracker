import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseReceipt, classifyError } from '../src/lib/gemini-parser.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED', retryable: false });
  }

  try {
    const { imageBytes, mimeType } = req.body ?? {};

    const result = await parseReceipt(imageBytes, mimeType);
    return res.status(200).json(result);
  } catch (error: unknown) {
    const classified = classifyError(error);
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Server is not configured for AI processing.', code: 'GEMINI_NOT_CONFIGURED', retryable: false });
    }
    return res.status(classified.status).json({ error: classified.message, code: classified.code, retryable: classified.retryable });
  }
}
