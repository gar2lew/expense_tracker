# LedgerDesk.AI

**AI-Powered Offline-First Expense Tracker**

A premium single-page application that scans receipts with Gemini AI, stores all data locally in IndexedDB, and generates printable audit-ready expense reports — all running entirely in your browser.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Vite 6 + React 19 (TypeScript) |
| **Styling** | Tailwind CSS v4 with custom design tokens |
| **Database** | IndexedDB via `idb` (offline-first, client-side) |
| **AI Engine** | Google Gemini 3.5 Flash (server-proxied) |
| **Backend** | Express.js (custom dev/prod server) |
| **Icons** | Lucide React |
| **Utilities** | date-fns |

---

## Key Features

- **AI Receipt Scanning** — Snap a photo or drag-and-drop a receipt; Gemini extracts vendor, amount, date, currency, and category automatically.
- **Intelligent Analytics** — AI-powered spending pattern detection, anomaly alerts (duplicate charges, outliers), personalized savings recommendations, and burn-rate forecasting.
- **100% Offline-First** — All expense data lives in your browser's IndexedDB. No cloud database, no account required. Scan receipts online, manage everything offline.
- **Printable Audit Reports** — Generate and print professional expense ledger reports with receipt image proof pages and a built-in signature pad.
- **JSON Backup & Restore** — Export your entire expense database as a downloadable JSON file; import to restore or merge across devices.
- **Responsive & Accessible** — Full mobile support with touch-optimized inputs, keyboard-navigable UI, and screen-reader-friendly ARIA labels.

---

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- A **Google Gemini API key** ([get one here](https://aistudio.google.com/apikey))

## Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Your Google Gemini API key for AI receipt parsing and analytics |
| `APP_URL` | No | The public URL where your app is hosted (set automatically by AI Studio) |

> The API key is **never exposed to the browser**. All Gemini calls are proxied through the Express server (`server.ts`).

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set your Gemini API key in .env
echo 'GEMINI_API_KEY=your-key-here' > .env

# 3. Start the dev server (Vite + Express on port 3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with Express middleware |
| `npm run build` | Build frontend + bundle server for production |
| `npm start` | Run the production build (requires `npm run build` first) |
| `npm run lint` | Type-check the entire project with `tsc --noEmit` |
| `npm run clean` | Remove `dist/` build output |

---

## Project Structure

```
.
├── server.ts                  # Express server + Gemini API proxy
├── vite.config.ts             # Vite configuration
├── tsconfig.json              # TypeScript strict mode config
├── index.html                 # SPA entry point
├── .env.example               # Environment variable template
├── src/
│   ├── main.tsx               # React entry point
│   ├── App.tsx                # Root application component
│   ├── index.css              # Tailwind v4 + custom theme tokens
│   ├── lib/
│   │   ├── db.ts              # IndexedDB CRUD operations
│   │   ├── backup.ts          # JSON export/import
│   │   ├── gemini.ts          # Client-side API bridge + type guards
│   │   └── utils.ts           # Currency formatting, date utils, image compression
│   ├── components/
│   │   ├── ReceiptUploader.tsx # Camera/drag-drop receipt upload
│   │   ├── ExpenseList.tsx     # Grouped expense table + edit modal
│   │   ├── GeminiAnalytics.tsx # AI spending analysis dashboard
│   │   ├── DataBackup.tsx      # Export/import controls
│   │   ├── SignaturePad.tsx    # HTML5 canvas signature pad
│   │   └── PrintButton.tsx     # Print trigger with pro-tip
│   ├── hooks/
│   │   └── useOnlineStatus.ts  # Browser online/offline detection
│   └── styles/
│       └── print.css           # Print-optimized CSS
└── public/                     # Static assets (if any)
```

---

## Deployment

### Vercel

1. Push your repository to GitHub.
2. In Vercel, create a new project and import the repo.
3. Configure build settings:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. Add the `GEMINI_API_KEY` environment variable in Vercel's project settings.
5. Deploy.

> Note: The Express server (`server.ts`) is bundled with `esbuild` into `dist/server.cjs` during the build step. For Vercel serverless, you may need to adapt the server to a Vercel Function. Alternatively, deploy the full-stack app on **Railway**, **Render**, or **Fly.io** where long-running Express servers are supported natively.

### Docker (Optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
```

---

## Architecture Decisions

- **Offline-First by Design** — IndexedDB stores everything locally. The app works fully offline for viewing, editing, and printing. AI features gracefully degrade when offline.
- **API Key Security** — The Gemini API key lives exclusively server-side in `process.env`. Client code calls `/api/parse-receipt` and `/api/analyze-expenses` endpoints; the key never touches the browser.
- **Image Compression** — Receipt images are compressed client-side to max 1200px before storage, keeping IndexedDB usage reasonable.
- **Type Safety** — Full strict TypeScript with runtime type guards for all API responses. Zero `any` types in the codebase.
- **Print CSS** — A dedicated `print.css` stylesheet with `@media print` rules hides UI chrome, sizes receipt images, and formats tables for professional paper output.

---

## License

MIT
