# PRD: Nikki's TradeLab

## Purpose

TradeLab is a personal trading dashboard for learning, practice, and execution review. It is designed to help a solo trader move through the full workflow:

- plan the day
- manage a watchlist
- scan for setups
- size trades
- simulate portfolio decisions
- journal real and paper trades
- review news, study material, and personal library content

## Users

- Primary user:
  owner account signed in with Supabase for cross-device sync
- Guest user:
  local-only mode using `localStorage`

## Product Principles

- Single-file frontend:
  core product logic remains inline in `index.html`
- No required frontend build step
- Optional auth and sync:
  app must still work when not signed in
- User-provided keys only:
  Finnhub, Anthropic, and YouTube keys are entered in the UI
- Mobile, tablet, and desktop support:
  the shell must remain usable across all major device sizes

## Core Areas

| Area | Purpose |
|---|---|
| `Today` | Daily command center with market status, rules, watchlist, scanner, portfolio simulator, earnings, risk dashboard, and recent trades |
| `Charts` | Live chart workflow and related chart tools |
| `Position Calc` | Risk-based position sizing, reward/risk, and rule checks |
| `P&L Journal` | Real trade logging, review, filtering, and analytics |
| `Paper Trade` | 90-day challenge tracker and progress calendar |
| `Live News` | Finnhub news feed plus AI-generated summary/brief workflows |
| `Classroom` | Video-based learning and study checklist |
| `Study` | Reference material, quizzes, and flashcards |
| `Library` | OneDrive/local folder trading content access |
| `Bot` | Trading code scaffolds and automation helpers |

## Feature Requirements

### Responsive Shell

- Desktop:
  left sidebar can stay docked
- Tablet/mobile:
  left sidebar must become a closable drawer
- Main content must stay navigable without the sidebar blocking the viewport

### PWA

- App must expose a manifest
- App must register a service worker
- App should be installable on supported browsers
- Offline support is shell-first, not full feature parity:
  live APIs and CDN-hosted dependencies may still require network

### Watchlist

- Add/remove symbols
- Save optional notes per symbol
- Reuse watchlist in charts, earnings, strategy scanner, and dashboard widgets

### Strategy Scanner

- Save one or more watchlist setup rules
- Rule fields:
  symbol, setup, bias, trigger, stop, target, relative volume, optional manual price
- Scanner output should classify setups into actionable states such as:
  triggered, near trigger, extended, invalidated, or missing price
- If Finnhub quote data is available, prefer live quote-assisted evaluation
- If live quotes are unavailable, support manual-price fallback

### Portfolio Simulator

- Start with a virtual cash balance
- Support buy/sell order simulation
- Track open positions, average cost, recent orders, realized P&L, and unrealized P&L
- Keep it local and lightweight:
  no broker integration required

### Position Calculator

- Use account size, risk percent, entry, stop, and optional target
- Compute shares, position value, and reward/risk
- Show rule-based guidance for novice risk control

### Trade Journal

- Log symbol, direction, entry, exit, shares, setup, and notes
- Show equity curve and trade analytics
- Feed dashboard summaries and risk metrics

### Paper Trading Challenge

- Track 90-day progress
- Log paper P&L, trade count, notes, and rules-followed checklist
- Surface progress in both the paper-trade area and sidebar/dashboard summaries

### News and AI Brief

- Pull market news from Finnhub
- Allow user to summarize or interpret news with AI when API keys are configured

### Classroom / Study / Library

- Classroom:
  load trading playlists from YouTube API
- Study:
  reference material, quiz mode, and flashcards
- Library:
  Microsoft sign-in and local-folder access paths

## Technical Constraints

- Frontend stays mostly in `index.html`
- No framework migration unless explicitly requested
- API keys must never be hardcoded
- Supabase remains optional
- Deployment target is Vercel

## Deployment

- Production URL:
  https://tradehub-sooty.vercel.app
- Linked Vercel project:
  `tradehub`

## Supporting Files

- `manifest.webmanifest`: install metadata
- `sw.js`: cache and shell behavior
- `icons/app-icon.svg` and `icons/app-icon-maskable.svg`: install icons
- `api/ai.js`: backend helper for AI requests
