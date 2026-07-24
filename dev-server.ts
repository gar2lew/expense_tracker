import 'dotenv/config';
import express from 'express';
import { parseReceipt, classifyError, isConfigured } from './src/lib/gemini-parser.js';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

app.post('/api/parse-receipt', async (req, res) => {
  try {
    const { imageBytes, mimeType } = req.body ?? {};
    const result = await parseReceipt(imageBytes, mimeType);
    return res.status(200).json(result);
  } catch (error: unknown) {
    const classified = classifyError(error);
    if (!isConfigured()) {
      return res.status(500).json({ error: 'Server is not configured for AI processing.', code: 'GEMINI_NOT_CONFIGURED', retryable: false });
    }
    return res.status(classified.status).json({ error: classified.message, code: classified.code, retryable: classified.retryable });
  }
});

app.listen(PORT, () => {
  console.log(`Dev API server running on http://localhost:${PORT}`);
  if (isConfigured()) console.log('Gemini API: configured');
  else console.log('Gemini API: not configured (set GEMINI_API_KEY)');
});
