# Vercel Deployment Checklist

## Pre-Deployment

- [ ] Push code to GitHub (`refactor/product-simplification` branch or merge to main)
- [ ] Verify `npm run build` succeeds locally
- [ ] Verify `npm test` passes locally (38 tests)
- [ ] Verify `npm run lint` passes (0 errors)

## Vercel Project Setup

1. Go to [vercel.com](https://vercel.com) and import the GitHub repository
2. Configure build settings:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
3. Add environment variable:
   - **Key:** `GEMINI_API_KEY`
   - **Value:** *(your Gemini API key)*
   - **Scopes:** Production, Preview, Development
4. Deploy

## Post-Deployment Verification

- [ ] App loads at Vercel URL
- [ ] Receipt scanning works (Gemini API)
- [ ] Manual entry works
- [ ] Paid/Unpaid toggle persists after refresh
- [ ] Theme selection persists
- [ ] Printable report opens
- [ ] Service worker registers (check DevTools > Application > Service Workers)
- [ ] Manifest loads (check DevTools > Application > Manifest)
- [ ] `/api/parse-receipt` returns 405 on GET (not intercepted by SPA)
- [ ] No `GEMINI_API_KEY` appears in browser network responses
- [ ] No `server.cjs` or Express server running in production

## Environment Variables Reference

| Variable | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Production | Vercel project env; changes require redeployment |
