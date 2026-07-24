# Expense Tracker - Gaz

Personal expense tracking with receipt scanning, AI extraction, and reimbursement tracking. PWA installable on iPhone.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure Gemini API key
cp .env.example .env
# Edit .env: GEMINI_API_KEY=your-key-here

# 3. Start local development
npm run dev:api    # Terminal 1: API server on :3000
npm run dev:ui     # Terminal 2: Vite dev server on :5173
```

Or use `npm run dev` to start both.

## Build

```bash
npm run build
```

Output: `dist/` (static SPA + PWA service worker)

## Vercel Deployment

1. Push to GitHub.
2. In Vercel, import the repository.
3. Configure environment variable:
   - `GEMINI_API_KEY` — your Google Gemini API key
4. Build command: `npm run build`
   Output directory: `dist`
   Install command: `npm install`
5. Deploy.

The `/api/parse-receipt` endpoint is a Vercel Serverless Function. SPA routing is handled by `vercel.json`.

## iPhone Installation

1. Open Safari on iPhone.
2. Navigate to your deployed Vercel URL.
3. Tap the Share button.
4. Tap "Add to Home Screen".
5. Name it and tap Add.

The app opens in standalone mode with its own window.

## IndexedDB Warning

Expense data is stored in your browser's IndexedDB. This data is **device-specific**:
- Data does not sync across devices
- Clearing Safari website data will delete all stored expenses
- Export a JSON backup regularly via the Backup panel
- Google Sheets sync is planned for a future release

## Known Offline Limitations

- Receipt scanning requires internet (Gemini API)
- The app UI, expense viewing, and toggling work offline
- Manual entry works offline

## Environment Variables

| Variable | Required | Location |
|---|---|---|
| `GEMINI_API_KEY` | Yes | `.env` (local), Vercel project env (production) |

Do not commit `.env`. Do not expose `GEMINI_API_KEY` in client-side code.

## Tech Stack

React 19 · TypeScript · Vite 6 · Tailwind CSS · IndexedDB · Gemini AI · PWA

## Documentation

- [Vercel Deployment Checklist](docs/VERCEL_DEPLOYMENT_CHECKLIST.md)
- [iPhone PWA QA](docs/IPHONE_PWA_QA.md)
