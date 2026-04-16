# TradeLab Auth & Multi-User Design

**Date:** 2026-04-16  
**Project:** Nikki's TradeLab — https://nikkis-tradehub.vercel.app  
**Repo:** https://github.com/nikkimasani/nikkis-tradehub  

---

## Overview

Add Supabase authentication and multi-user support to TradeLab. The app is currently single-user with all data in plain localStorage. This design adds a login gate, per-user data isolation via user-keyed localStorage, leaderboard, admin panel, and a shared file library — modelled closely on the PMP Dashboard implementation.

---

## Users & Access

- **Target:** Small trading group (2–5 people), architected to scale to larger groups
- **Access model:** Fully gated — login required to see any part of the app
- **Admin:** Nikki (`nikkimasani@gmail.com`) — detected via `ADMIN_EMAILS` array, same as PMP
- **Supabase project:** Existing "tradehub" project (URL and anon key provided at implementation time)

---

## Auth Layer

### Login Overlay
- Full-screen overlay shown on load if no active Supabase session
- Two views: **Sign In** and **Create Account** — toggle in-place, no reload
- Styled in TradeLab's dark charcoal theme with lime (`#c8ff00`) accent
- Fields: Sign In (email, password) / Create Account (name, email, password)

### Auth Flow
```
initAuth()
  └─ createClient(SB_URL, SB_KEY)
  └─ getSession()
       ├─ session exists → onAuthReady(user)
       └─ no session   → showAuthOverlay()

onAuthStateChange()
  ├─ SIGNED_IN  → onAuthReady(user)
  └─ SIGNED_OUT → showAuthOverlay()

onAuthReady(user)
  └─ hideAuthOverlay()
  └─ load td_profiles for user
  └─ run first-login migration (if needed)
  └─ show admin tab (if admin email)
  └─ populate user pill in nav
  └─ pull stats from Supabase
  └─ start periodic sync (5 min + visibilitychange)
```

### Key Functions
| Function | Purpose |
|---|---|
| `initAuth()` | Init Supabase client, restore session or show overlay |
| `doSignIn()` | Email/password sign-in |
| `doSignUp()` | Register with name + email + password; inserts profile row |
| `doSignOut()` | Sign out, clear current user, show overlay |
| `onAuthReady(user)` | Post-login setup — migration, stats pull, UI wiring |
| `showAuthOverlay()` / `hideAuthOverlay()` | Toggle the full-screen auth overlay |

---

## Data Layer

### Per-User localStorage (Approach B — user-keyed)

After login, all personal data keys are suffixed with the user's Supabase UID:

| Key | Description |
|---|---|
| `td_trades_<userId>` | P&L trade journal entries |
| `td_paper_<userId>` | 90-day paper challenge data |
| `td_watchlist_<userId>` | Watchlist symbols |
| `td_quiz_history_<userId>` | Quiz attempt history |
| `td_kb_mastery_<userId>` | Knowledge base mastery scores |
| `td_kb_tags_<userId>` | KB custom tags |
| `td_strategy_notes_<userId>` | Strategy notes |
| `td_flashcard_weak_<userId>` | Flashcard weak spots |
| `td_lib_watched_<userId>` | Library watched items |

**API keys remain device-level (no suffix):**
- `td_finnhub_key`, `td_anthropic_key`, `td_yt_key`

### First-Login Migration
On first login, if any unkeyed personal keys exist in localStorage (from pre-auth usage), they are automatically migrated to user-keyed equivalents and the originals deleted. Runs once, silently.

```js
// Example migration
const OLD_KEYS = ['td_trades','td_paper','td_watchlist', ...];
OLD_KEYS.forEach(key => {
  const val = localStorage.getItem(key);
  if (val) {
    localStorage.setItem(`${key}_${userId}`, val);
    localStorage.removeItem(key);
  }
});
```

### Supabase Tables

```sql
-- User profiles
CREATE TABLE td_profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id),
  name       text NOT NULL,
  role       text NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
  created_at timestamptz DEFAULT now()
);

-- Aggregate stats for leaderboard (synced from localStorage)
CREATE TABLE td_user_stats (
  user_id            uuid PRIMARY KEY REFERENCES td_profiles(id),
  paper_pnl          numeric DEFAULT 0,
  paper_win_rate     numeric DEFAULT 0,   -- percentage 0-100
  paper_trades_count integer DEFAULT 0,
  last_synced        timestamptz DEFAULT now()
);

-- Real trade journal entries (full sync — cross-device + admin visibility)
CREATE TABLE td_journal_trades (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES td_profiles(id),
  date      text NOT NULL,
  symbol    text NOT NULL,
  dir       text NOT NULL,       -- 'Long' | 'Short'
  entry     numeric NOT NULL,
  exit      numeric NOT NULL,
  shares    integer NOT NULL,
  pnl       numeric NOT NULL,
  pnl_pct   numeric NOT NULL,
  setup     text DEFAULT '',
  notes     text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
```

RLS policies:
- `td_profiles`, `td_user_stats`: auth users can read all rows (leaderboard needs this), write only their own
- `td_journal_trades`: users can read and write only their own rows; admin can read all

### Supabase Sync
- `syncToSupabase()` — upserts `td_user_stats` (paper aggregates) + syncs `td_journal_trades` (full trade array diff against Supabase)
- `pullFromSupabase()` — on login, pulls user's own stats + trade journal rows into localStorage (cross-device restore)
- Triggers: every 5 minutes + `visibilitychange` event
- Trade sync strategy: fetch all existing `td_journal_trades` rows for user, compare with localStorage array by `(date, symbol, entry, exit, shares)`, insert new rows only (no updates/deletes to avoid destructive sync)

---

## Leaderboard Tab

- **Nav label:** `🏆 Leaderboard`
- **Visible to:** All logged-in users
- **Data source:** `td_user_stats` JOIN `td_profiles`
- **Columns:** Rank, Name, Paper P&L, Win Rate, Trades
- **Sorted by:** Paper P&L descending
- **Refresh:** Manual refresh button + loads fresh on tab open

---

## Admin Panel

- **Nav label:** `🛡️ Admin` — hidden by default, shown only for `ADMIN_EMAILS`
- **Data:** All users from `td_profiles` JOIN `td_user_stats`
- **Columns:** Name, Email, Paper P&L, Win Rate, Trades, Last Active (last_synced)
- **Controls:** Refresh button, Sign Out button
- **Behaviour:** Loads data on tab open via `loadAdminPanel()`

---

## File Library Tab (updated)

The existing **Library** tab (`data-tab="library"`) gets a "Shared Folder" guide section added at the top, matching the PMP Dashboard pattern:

**Step-by-step guide:**
1. Open the shared TradeLab folder (button opens OneDrive link)
2. Download as ZIP, extract to a local folder (e.g. `Documents/TradeLab`)
3. Click **Connect My Folder** → browser file picker → every file gets an **Open →** button

**Shared folder link:** `https://1drv.ms/f/c/12dc5ef91903e837/IgCuGsSk0pT8QZePQcCk0KqMAabt82BPPGaT50UjMVVZZx4?e=zczhsp`

Local file access uses `showDirectoryPicker()` API. Works in Chrome and Edge.

---

## Nav & UI Changes

| Change | Detail |
|---|---|
| User pill | First initial avatar + first name shown in nav after login |
| Sign Out | Button in admin panel header (not in main nav) |
| `🏆 Leaderboard` tab | Added to nav, visible to all logged-in users |
| `🛡️ Admin` tab | Added to nav, hidden (`display:none`), shown only for admin email |

All existing tabs and nav structure remain unchanged.

---

## Supabase Credentials

Provided at implementation time. Store as:
```js
const SB_URL = 'https://<tradehub-project-ref>.supabase.co';
const SB_KEY = '<anon-key>';
const ADMIN_EMAILS = ['nikkimasani@gmail.com'];
```

---

## Out of Scope

- No email verification flow
- No password reset UI (users can use Supabase dashboard)
- No profile edit screen post-registration
