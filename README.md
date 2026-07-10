# Nikki's TradeLab

A personal trading practice and education dashboard with live charts, journaling, a paper-trading challenge, watchlist-driven scanning, a local portfolio simulator, classroom content, and a connected trading library.

**Live site:** https://tradehub-sooty.vercel.app

## Current App Surface

TradeLab is a single-page app with these primary areas:

- `Today`: daily dashboard, trading rules, watchlist, earnings, risk dashboard, strategy scanner, and portfolio simulator
- `Charts`: TradingView chart workspace plus RSI tools
- `Position Calc`: risk-based position sizing and reward/risk checks
- `P&L Journal`: real trade logging, equity curve, and trade analytics
- `Paper Trade`: 90-day challenge tracker
- `Live News`: Finnhub-powered market news and AI brief tools
- `Classroom`: YouTube playlist learning area
- `Study`: reference content, quiz, flashcards, and the in-app Guide (how to use every tool)
- `Library`: OneDrive/local-folder trading library
- `Bot`: code scaffolding and trading automation helpers

## Project Structure

```text
tradehub/
├── index.html              # Main app: HTML, CSS, and JS in one file
├── admin.html              # Admin page
├── api/
│   └── ai.js               # Serverless AI helper endpoint
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # Service worker
├── icons/
│   ├── app-icon.svg
│   └── app-icon-maskable.svg
├── PRD.md                  # Product requirements
├── CLAUDE.md               # AI/dev instructions for this repo
└── README.md               # This file
```

Most product logic still lives in `index.html`. There is no frontend build step or framework.

## Recent Features

- Pattern Lab (Trade menu):
  synthetic-chart pattern detector, setup recognition trainer, and R-based strategy backtester — no API key needed
- Mobile dashboard sections:
  on phones, the Today modules collapse behind tappable headers (state remembered per device), the stat cards form a 2-column grid, and scrolling no longer rubber-bands before the bottom
- How-to guides:
  "📘 How to use" panels inside the Strategy Scanner, Portfolio Simulator, and Bot Builder, plus the full Guide under Study; all ? tooltips now open on tap
- Quiz bank expansion:
  200 questions total — 25 in each of the 8 categories
- OneDrive sign-in fix:
  the Library now uses an app registration that has the production redirect URI registered
- Responsive shell update:
  the left sidebar is now a drawer on tablet/mobile instead of consuming the layout
- PWA support:
  manifest, theme color, icons, and service worker registration are now present
- Strategy scanner:
  save rule-based setups per watchlist symbol and scan for triggered, near-trigger, extended, or invalidated states
- Portfolio simulator:
  local cash, positions, orders, realized P&L, and unrealized P&L tracking

## Local Preview

For basic UI checks, open `index.html` directly in Chrome or Edge.

For PWA testing, service worker testing, or anything that depends on browser-origin behavior, use a local web server instead of opening the file directly.

## Data and Keys

Persistence uses `localStorage` first and can sync through Supabase when signed in. App keys are stored with the `td_` prefix.

User-entered API keys:

- `td_finnhub_key`: live news, earnings, quote-assisted scanner data
- `td_anthropic_key`: AI brief / AI study features
- `td_yt_key`: classroom playlist loading

## Deployment

This project is linked to Vercel project `tradehub`.

- Production URL: https://tradehub-sooty.vercel.app
- Auto-deploy: pushes to the connected branch can deploy through Vercel
- Manual deploy:

```bash
cd C:\Users\nikki\tradehub
vercel deploy --prod --yes
```

## Editing Notes

- Keep the app single-file unless there is a strong reason not to.
- When you add new dashboard modules, update:
  `README.md`, `PRD.md`, and `CLAUDE.md`
- If you change installability or caching behavior, also review:
  `manifest.webmanifest`, `sw.js`, and icon assets
