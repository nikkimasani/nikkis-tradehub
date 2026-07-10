# CLAUDE.md

This file provides guidance for AI-assisted development in this repository.

## What This Is

Nikki's TradeLab is a personal trading dashboard and study workspace.

- Live: https://tradehub-sooty.vercel.app
- Hosting: Vercel
- Repo shape: mostly static single-file app plus a small `api/` helper

## Local Run Model

- Basic UI preview:
  open `index.html` in Chrome or Edge
- PWA/service-worker validation:
  use a local web server or deployed environment

Do not assume `file://` behavior is equivalent to deployed behavior for installability or caching.

## Architecture

Primary frontend lives in `index.html`:

- HTML structure
- inline CSS
- inline JS application logic

Supporting files:

- `manifest.webmanifest`
- `sw.js`
- `icons/app-icon.svg`
- `icons/app-icon-maskable.svg`
- `api/ai.js`
- `admin.html`

Do not split the app into framework files unless explicitly asked.

## Navigation Model

Top nav tabs use `data-tab`, and panels use `id="panel-{name}"`.

Current primary tabs:

| `data-tab` | Purpose |
|---|---|
| `today` | Daily dashboard |
| `charts` | Chart workspace |
| `calc` | Position calculator |
| `journal` | P&L journal |
| `paper` | Paper-trading challenge |
| `news` | Live news |
| `classroom` | Video classroom |
| `learn` | Study/reference/quiz/flashcards |
| `library` | Trading library |
| `bot` | Bot/code generation helpers |

Important:

- The mobile/tablet shell now uses a drawer sidebar pattern.
- `switchTab(...)` and sidebar state are coupled on smaller viewports.

## Data Layer

Persistence uses `localStorage` and optional Supabase sync.

Core helpers:

```js
dbSet(key, value)
dbGet(key)
dbRemove(key)
```

Storage prefix:

- `td_`

Common persisted keys:

- `td_watchlist`
- `td_trades`
- `td_paper`
- `td_strategy_scanner`
- `td_strategy_scan_results`
- `td_portfolio_sim`
- `td_cls_notes`
- `td_cls_checks`
- `td_quiz_history`
- `td_quiz_catstats`
- `td_rules`
- `td_max_loss`
- `td_today_secs` (mobile dashboard section open/closed state)
- `td_lib_client_id` (Azure app client ID override for OneDrive sign-in)

User-entered API keys:

- `td_finnhub_key`
- `td_anthropic_key`
- `td_yt_key`

Never hardcode API credentials.

## Current Feature Expectations

When editing the app, preserve these current capabilities:

- Responsive sidebar/drawer shell
- PWA manifest and service worker registration
- Watchlist with notes
- Strategy scanner on the Today dashboard
- Portfolio simulator on the Today dashboard
- Position calculator and journal analytics
- Paper-trade challenge and progress summaries
- Finnhub-driven news and earnings tools
- Classroom, study, library, and bot sections

## Editing Guidance

- Keep edits coherent with the current visual language and single-file structure.
- If you add a new dashboard module, update the user docs in:
  `README.md` and `PRD.md`
- If you change navigation, also verify:
  tab buttons, `switchTab(...)`, panel IDs, and mobile drawer behavior
- If you change installability/caching behavior, also review:
  `manifest.webmanifest`, `sw.js`, and icon references in `index.html`
- If you change local persistence, update this file's key list

## Deployment

Project is linked to Vercel project `tradehub`.

Typical manual production deploy:

```bash
cd C:\Users\nikki\tradehub
vercel deploy --prod --yes
```

Current production alias:

- https://tradehub-sooty.vercel.app
