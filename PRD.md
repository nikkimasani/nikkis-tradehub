# PRD: Nikki's TradeLab

## Purpose

A personal trading education and practice dashboard. Everything in one HTML file — no backend dependency. Helps users build trading knowledge, track paper trades, journal real trades, and stay on top of market news.

## Users

Primary user (owner) signs in via Supabase auth for cross-device sync. Guest users can access the app without sign-in using localStorage only.

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
| Library | Trading video and document library — two connection modes: (1) Sign in with Microsoft to auto-connect a personal OneDrive folder via Graph API; (2) Download the public shared folder and connect it locally via the File System Access API (Chrome/Edge) |

## Library — Connection Modes

### Mode 1: Microsoft Sign-In (OneDrive)
- Uses MSAL.js (`@azure/msal-browser`) with a registered Azure SPA app
- Authority: `https://login.microsoftonline.com/consumers` (personal Microsoft accounts)
- Scopes: `Files.Read`, `User.Read`
- Reads files from a shared OneDrive folder via Microsoft Graph API
- Supports folder navigation, inline video playback, and document opening

### Mode 2: Local Folder (offline)
- User downloads the public OneDrive share, saves locally
- Connects via `showDirectoryPicker()` (File System Access API)
- Supports folder navigation, inline video playback via `URL.createObjectURL()`
- Chrome and Edge only; reconnect required after page reload

## Technical Constraints

- Single HTML file — all CSS and JS must remain inline in `index.html`
- No build step, no npm, no framework
- API keys (Finnhub, Anthropic, YouTube) entered by the user in the UI — never hardcoded
- Supabase is optional; the app must work fully with localStorage as fallback

## Deployment

Vercel (auto-deploys from `main`). Static HTML — no build command needed.  
Live at https://nikkis-tradehub.vercel.app
