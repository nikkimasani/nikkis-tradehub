# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Nikki's TradeLab — a personal trading education and practice dashboard. No build step, no npm, no server required.

**Live:** https://nikkis-tradehub.vercel.app  
**Repo:** https://github.com/nikkimasani/nikkis-tradehub  
**Auto-deploy:** Vercel deploys within ~30 seconds on every push to `main`.

## Running Locally

Open `index.html` directly in Chrome or Edge. No dev server needed.

## Architecture

Single-file app: all HTML structure, `<style>` block, and `<script>` block live in `index.html`. Do not split into separate files unless explicitly asked.

## Tabs

Tab elements use `data-tab` attribute; panels use `id="panel-{name}"`. Switching is handled via click listeners on `.tab` elements.

| `data-tab` | Purpose |
|---|---|
| `guide` | Start Here / user guide |
| `charts` | TradingView live chart |
| `calc` | Position size calculator |
| `rsi` | RSI simulator |
| `journal` | P&L trade journal |
| `paper` | 90-day paper trade challenge |
| `news` | Live news via Finnhub API |
| `classroom` | YouTube playlist player |
| `quiz` | Trading knowledge quiz with AI generation |
| `learn` | Knowledge base |
| `practice` | Flashcard practice |
| `resources` | Curated links |
| `library` | My Library / file connector |

## Data Layer

Persistence uses Supabase as primary and `localStorage` as fallback. All reads/writes go through:

```js
dbSet(key, value)   // saves to localStorage, syncs to Supabase
dbRemove(key)       // removes from localStorage
dbInit()            // on load: pulls from Supabase, falls back to localStorage
```

**localStorage key prefix:** `td_`

Key storage variables (initialised in `dbInit`):
- `td_watchlist` → `watchlist[]`
- `td_trades` → `trades[]`
- `td_paper` → `paperData`
- `td_cls_notes` → `clsNotes[]`
- `td_quiz_history` → `_quizHistory[]`
- `td_kb_mastery`, `td_kb_tags`, `td_strategy_notes`, `td_flashcard_weak`, `td_lib_watched`

API keys (set by user in UI, stored in localStorage — never hardcode these):
- `td_finnhub_key` — Live News tab
- `td_anthropic_key` — Quiz AI generation
- `td_yt_key` — Classroom tab

## Deploying

```bash
git add .
git commit -m "describe change"
git push
```

Vercel auto-deploys on push. No manual deploy step needed.
