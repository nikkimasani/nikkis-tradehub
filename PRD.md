# PRD: Nikki's TradeLab

## Purpose

A personal trading education and practice dashboard. Everything in one HTML file — no accounts required, no backend dependency. Helps the owner build trading knowledge, track paper trades, journal real trades, and stay on top of market news.

## Users

Single user (personal tool). No sign-in required; Supabase sync is optional for cross-device access.

## Features

| Tab | Description |
|---|---|
| Start Here | Orientation guide for first-time use |
| Live Charts | Embedded TradingView chart with symbol search |
| Position Calc | Risk-based position size calculator (entry price, stop level, account %) |
| RSI Simulator | Interactive RSI concept explainer and simulator |
| Trade Journal | Log real P&L trades with running totals |
| Paper Challenge | 90-day paper trading tracker with virtual bankroll |
| News | Live headlines via Finnhub API, filterable by watchlist symbols |
| Classroom | Embedded YouTube playlist player for trading courses |
| Quiz | AI-generated trading knowledge questions via Anthropic API |
| Knowledge Base | Curated articles and concept explainers |
| Flashcards | Spaced-repetition practice on weak concepts |
| Resources | Curated external links |
| My Library | Personal note and video connector |

## Technical Constraints

- Single HTML file — all CSS and JS must remain inline in `index.html`
- No build step, no npm, no framework
- API keys (Finnhub, Anthropic, YouTube) entered by the user in the UI — never hardcoded in source
- Supabase is optional; the app must work fully offline with localStorage as the only store

## Deployment

Vercel (auto-deploys from `main`). Static HTML — no build command needed.  
Live at https://nikkis-tradehub.vercel.app
