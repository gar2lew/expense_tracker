import express from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

// Create application
const app = express();
const PORT = 3000;

// Boost body parsing limit for base64 image streams
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Server-side safe Gemini client initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// API Proxy route for Receipt parsing
app.post('/api/parse-receipt', async (req, res) => {
  try {
    const { imageBytes, mimeType } = req.body;
    
    if (!imageBytes) {
      return res.status(400).send('No image bytes provided');
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).send('GEMINI_API_KEY environment variable is not defined on the server secrets.');
    }

    // Build the request payload for Gemini 3.5 Flash
    const imagePart = {
      inlineData: {
        data: imageBytes,
        mimeType: mimeType || 'image/jpeg',
      },
    };

    const promptText = `
      You are an expert receipt parsing AI. Analyze the uploaded receipt image and extract the requested fields.
      Ensure accuracy in decimal amounts, dates, and currency detection.
      If some fields are blurry or missing, utilize context to make highly educated guesses.
      The current year context is 2026.
    `;

    // Make content generation request with strict JSON schema validation
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        imagePart,
        { text: promptText }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { 
              type: Type.STRING, 
              description: 'Transaction date strictly formatted as YYYY-MM-DD. Current year is 2026. Use best guess if date is partially visible.' 
            },
            vendor: { 
              type: Type.STRING, 
              description: 'Clean formatted merchant or vendor name, e.g. "Trader Joes", "Uber", "Apple Store".' 
            },
            totalAmount: { 
              type: Type.NUMBER, 
              description: 'The final absolute total payment amount after taxes, discounts, and tips as a decimal number.' 
            },
            currency: { 
              type: Type.STRING, 
              description: 'ISO 3-Letter currency code (e.g., AUD, USD, EUR, CAD, GBP). Default to AUD if ambiguous.' 
            },
            category: { 
              type: Type.STRING, 
              description: 'Must match one of these specific strings: "Food & Dining", "Supplies", "Travel", "Utilities", "Retail", "Subscriptions", "Entertainment", "Other"' 
            },
            description: { 
              type: Type.STRING, 
              description: 'A brief 1-sentence listing of main items or summary index (e.g. "Office supplies and notebook", "Dinner with client").' 
            }
          },
          required: ['date', 'vendor', 'totalAmount', 'currency', 'category', 'description'],
        },
      },
    });

    const parsedText = response.text;
    if (!parsedText) {
      throw new Error('Gemini returned empty text response.');
    }

    // Parse verified JSON output and return
    const resultObj = JSON.parse(parsedText.trim());
    return res.json(resultObj);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error parsing receipt:', message);
    return res.status(500).send(`Receipt Parsing Error: ${message}`);
  }
});

// API Proxy route for spending analysis & pattern insights
app.post('/api/analyze-expenses', async (req, res) => {
  try {
    const { expenses } = req.body;

    if (!expenses || !Array.isArray(expenses)) {
      return res.status(400).send('Expenses list is missing or invalid.');
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).send('GEMINI_API_KEY environment variable is not defined on the server secrets.');
    }

    const todayDate = new Date().toISOString().split('T')[0];

    const promptText = `
      You are an elite financial strategist and personal wealth advisor AI. Analyze the uploaded list of expense records and extract key structural patterns, anomalous entries, double-payments, and provide highly actionable recommendations to optimize capital outflow.
      
      Here is the list of user expenses:
      ${JSON.stringify(expenses, null, 2)}

      Current Date is: ${todayDate}. Note that all monetary values are centered around AUD as the base operating currency.

      Perform the following duties:
      1. Examine the cumulative outflow across categories, highlight double transactions (e.g. identical vendor, amount, same day or consecutive days), outliers (huge unexpected costs), and abnormal frequency spikes of subscription or dining costs.
      2. Provide a 2-3 sentence inspiring but highly professional and concise executive summary of their financial health.
      3. Point out 2-3 specific "patterns" (e.g., dining costs, subscription inflation, fuel costs). Provide title, explanation, iconType ("trend-up", "trend-down", "caution", "info", "repeating"), and impact description.
      4. Point out 1-2 "anomalies" or warning signs (e.g., duplicate entries, high-variance costs). If none exist, output empty array, or suggest a mild variance anomaly.
      5. Provide 3 highly personalized step-by-step "recommendations" to save or organize better.
      6. Provide a burnRate forecast for next month, calculating average monthly burn over the visible timeline and predicting next month based on pattern trends.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { 
              type: Type.STRING, 
              description: 'Professional executive summary of spending habits, trends, and financial health.' 
            },
            patterns: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: 'Short title of the trend (e.g., "Frequent Ride-Sharing", "Weekly Groceries Spike").' },
                  description: { type: Type.STRING, description: 'Brief analytical description of this behavior.' },
                  iconType: { type: Type.STRING, description: 'One of: trend-up, trend-down, caution, info, repeating.' },
                  impact: { type: Type.STRING, description: 'Estimated savings or spend rate, e.g., "$40 AUD / week" or "8% of budget"' }
                },
                required: ['title', 'description', 'iconType', 'impact']
              },
              description: 'List of observed spend behaviors and recurrences.'
            },
            anomalies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: 'Anomalous cost name or alert.' },
                  description: { type: Type.STRING, description: 'Why this is anomalous or seems like a duplicate entry.' },
                  badge: { type: Type.STRING, description: 'Severity category, e.g., "Duplicate Alert", "High Variance", "Outlier Spend".' }
                },
                required: ['title', 'description', 'badge']
              },
              description: 'Alerts of duplicate entries, odd merchant spikes, or suspicious pricing variations.'
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 highly specific and actionable wealth tips based on their actual merchant list.'
            },
            burnRate: {
              type: Type.OBJECT,
              properties: {
                averageMonthly: { type: Type.STRING, description: 'Calculated average monthly spend formatted as text (e.g., "$450.00 AUD").' },
                forecastNextMonth: { type: Type.STRING, description: 'AI estimated total spend for the coming month (e.g., "$410.00 AUD").' },
                confidence: { type: Type.STRING, description: 'High, Medium, or Low based on the number and cleanliness of transaction records.' }
              },
              required: ['averageMonthly', 'forecastNextMonth', 'confidence']
            }
          },
          required: ['summary', 'patterns', 'anomalies', 'recommendations', 'burnRate'],
        },
      },
    });

    const parsedText = response.text;
    if (!parsedText) {
      throw new Error('Gemini returned empty overview response.');
    }

    const resultObj = JSON.parse(parsedText.trim());
    return res.json(resultObj);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error analyzing expenses:', message);
    return res.status(500).send(`Expense Analysis Error: ${message}`);
  }
});

// Vite-friendly mounting
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    // Use Vite's connect instance as middleware
    app.use(vite.middlewares);
  } else {
    // Serve production static assets from dist
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
  console.error('Failed to start full-stack server:', message);
});
