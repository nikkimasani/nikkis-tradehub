# TradeLab Auth & Multi-User Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase auth, per-user data isolation, leaderboard, admin panel, and file library to TradeLab.

**Architecture:** Single-file app (`index.html`). Full-screen auth overlay gates the app. After login, all personal localStorage keys are suffixed with the user's UID. Aggregate stats + full trade journal sync to Supabase. Leaderboard and admin panel read from Supabase.

**Tech Stack:** Vanilla HTML/CSS/JS, Supabase JS v2 (CDN), `showDirectoryPicker()` File System Access API

**Note on testing:** No test runner — verification is done by opening `index.html` in Chrome and checking behavior described in each verification step.

---

### Before You Start

You need two values from the Supabase "tradehub" project dashboard (Settings → API):
- `SB_URL` — Project URL (e.g. `https://xxxx.supabase.co`)
- `SB_KEY` — anon/public key

Have these ready before Task 2.

---

### Task 1: Create Supabase Tables

**Files:**
- No code changes — run SQL in Supabase Dashboard → SQL Editor

- [ ] **Step 1: Run this SQL in the Supabase SQL Editor**

```sql
-- User profiles
CREATE TABLE IF NOT EXISTS td_profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  role       text NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);

-- Aggregate leaderboard stats
CREATE TABLE IF NOT EXISTS td_user_stats (
  user_id            uuid PRIMARY KEY REFERENCES td_profiles(id) ON DELETE CASCADE,
  paper_pnl          numeric DEFAULT 0,
  paper_win_rate     numeric DEFAULT 0,
  paper_trades_count integer DEFAULT 0,
  last_synced        timestamptz DEFAULT now()
);

-- Real trade journal entries
CREATE TABLE IF NOT EXISTS td_journal_trades (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES td_profiles(id) ON DELETE CASCADE,
  date       text NOT NULL,
  symbol     text NOT NULL,
  dir        text NOT NULL,
  entry      numeric NOT NULL,
  exit_price numeric NOT NULL,
  shares     integer NOT NULL,
  pnl        numeric NOT NULL,
  pnl_pct    numeric NOT NULL,
  setup      text DEFAULT '',
  notes      text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
```

- [ ] **Step 2: Enable RLS and add policies**

```sql
-- RLS on td_profiles
ALTER TABLE td_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all profiles" ON td_profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert own profile" ON td_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON td_profiles FOR UPDATE USING (auth.uid() = id);

-- RLS on td_user_stats
ALTER TABLE td_user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all stats" ON td_user_stats FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can upsert own stats" ON td_user_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stats" ON td_user_stats FOR UPDATE USING (auth.uid() = user_id);

-- RLS on td_journal_trades
ALTER TABLE td_journal_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own trades" ON td_journal_trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades" ON td_journal_trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own trades" ON td_journal_trades FOR DELETE USING (auth.uid() = user_id);
```

- [ ] **Step 3: Verify**

In Supabase → Table Editor, confirm `td_profiles`, `td_user_stats`, and `td_journal_trades` exist with correct columns.

---

### Task 2: Add Supabase CDN + Constants

**Files:**
- Modify: `index.html` — `<head>` block (line ~6) and top of `<script>` block (line ~1264)

- [ ] **Step 1: Add Supabase CDN to `<head>`**

Find `</head>` (line ~7) and add before it:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

- [ ] **Step 2: Add constants at the top of the `<script>` block**

Find `<script>` (line ~1264) and add immediately after it:

```js
// ==================== SUPABASE AUTH ====================
const SB_URL = 'YOUR_SUPABASE_PROJECT_URL';   // from Supabase Settings → API
const SB_KEY = 'YOUR_SUPABASE_ANON_KEY';      // from Supabase Settings → API
const ADMIN_EMAILS = ['nikkimasani@gmail.com'];
let sbClient = null, currentUser = null;
```

Replace `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_ANON_KEY` with your actual values.

- [ ] **Step 3: Verify**

Open `index.html` in Chrome. Open DevTools Console. Type `window.supabase` — should return the Supabase object, not `undefined`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add Supabase CDN and auth constants"
```

---

### Task 3: Auth Overlay HTML + CSS

**Files:**
- Modify: `index.html` — CSS `<style>` block and HTML body (before `<nav>`)

- [ ] **Step 1: Add auth overlay CSS**

Find the end of the `</style>` tag and add before it:

```css
/* ===================== AUTH OVERLAY ===================== */
#auth-overlay { position:fixed; inset:0; background:rgba(10,14,23,.97); display:flex; align-items:center; justify-content:center; z-index:9999; }
#auth-overlay.hidden { display:none; }
.auth-card { background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:32px 28px; width:320px; box-shadow:0 8px 48px rgba(0,0,0,.6); }
.auth-badge { font-size:11px; font-weight:800; letter-spacing:1px; color:var(--accent); margin-bottom:6px; }
.auth-title { font-size:20px; font-weight:800; color:var(--text); margin-bottom:4px; }
.auth-sub { font-size:13px; color:var(--muted); margin-bottom:20px; }
.auth-field { margin-bottom:14px; }
.auth-field label { display:block; font-size:11px; color:var(--muted); margin-bottom:5px; font-weight:600; text-transform:uppercase; letter-spacing:.5px; }
.auth-field input { width:100%; background:var(--bg); border:1px solid var(--border); color:var(--text); padding:9px 12px; border-radius:8px; font-size:13px; font-family:var(--font); }
.auth-field input:focus { outline:none; border-color:var(--accent); }
.auth-err { font-size:12px; color:var(--warn); min-height:18px; margin-bottom:8px; }
.auth-btn { width:100%; background:linear-gradient(135deg,var(--accent),#a78bfa); color:#0a0e17; font-weight:800; font-size:14px; border:none; border-radius:8px; padding:11px; cursor:pointer; font-family:var(--font); }
.auth-btn:hover { opacity:.9; }
.auth-toggle { font-size:12px; color:var(--muted); text-align:center; margin-top:14px; }
.auth-toggle a { color:var(--accent); cursor:pointer; text-decoration:underline; }
/* User pill in header */
#user-pill { display:none; align-items:center; gap:8px; }
.user-avatar { width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,var(--accent),#a78bfa); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; color:#0a0e17; flex-shrink:0; }
.user-name { font-size:12px; font-weight:600; color:var(--text); }
```

- [ ] **Step 2: Add auth overlay HTML**

Find `<nav>` (line ~489) and add immediately before it:

```html
<!-- ===== AUTH OVERLAY ===== -->
<div id="auth-overlay">
  <!-- Sign In -->
  <div id="auth-view-login" class="auth-card">
    <div class="auth-badge">TRADEHUB</div>
    <div class="auth-title">Welcome back</div>
    <div class="auth-sub">Sign in to your account</div>
    <div class="auth-field"><label>Email</label><input type="email" id="auth-email" placeholder="you@email.com" onkeydown="if(event.key==='Enter')doSignIn()"></div>
    <div class="auth-field"><label>Password</label><input type="password" id="auth-password" placeholder="••••••••" onkeydown="if(event.key==='Enter')doSignIn()"></div>
    <div class="auth-err" id="auth-error"></div>
    <button class="auth-btn" onclick="doSignIn()">Sign In →</button>
    <div class="auth-toggle">No account? <a onclick="showAuthView('register')">Create one</a></div>
  </div>
  <!-- Register -->
  <div id="auth-view-register" class="auth-card" style="display:none">
    <div class="auth-badge">TRADEHUB</div>
    <div class="auth-title">Create account</div>
    <div class="auth-sub">Join your trading group</div>
    <div class="auth-field"><label>Your Name</label><input type="text" id="reg-name" placeholder="First name"></div>
    <div class="auth-field"><label>Email</label><input type="email" id="reg-email" placeholder="you@email.com"></div>
    <div class="auth-field"><label>Password</label><input type="password" id="reg-password" placeholder="Min 6 characters" onkeydown="if(event.key==='Enter')doSignUp()"></div>
    <div class="auth-err" id="reg-error"></div>
    <button class="auth-btn" onclick="doSignUp()">Create Account →</button>
    <div class="auth-toggle">Already have one? <a onclick="showAuthView('login')">Sign in</a></div>
  </div>
</div>
```

- [ ] **Step 3: Add user pill to header**

Find `<span id="clock">` inside `<div class="header-right">` and add before it:

```html
<div id="user-pill">
  <div class="user-avatar" id="user-avatar">N</div>
  <span class="user-name" id="user-name">Nikki</span>
</div>
```

- [ ] **Step 4: Verify**

Open `index.html` in Chrome. The auth overlay should appear over a dark background showing the Sign In card. Clicking "Create one" should switch to the Create Account card.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add auth overlay HTML and CSS"
```

---

### Task 4: Auth JS Functions

**Files:**
- Modify: `index.html` — `<script>` block, in the `SUPABASE AUTH` section added in Task 2

- [ ] **Step 1: Add all auth functions directly after the constants from Task 2**

```js
function showAuthOverlay() {
  document.getElementById('auth-overlay').classList.remove('hidden');
}
function hideAuthOverlay() {
  document.getElementById('auth-overlay').classList.add('hidden');
}
function showAuthView(view) {
  document.getElementById('auth-view-login').style.display = view === 'login' ? '' : 'none';
  document.getElementById('auth-view-register').style.display = view === 'register' ? '' : 'none';
  document.getElementById('auth-error').textContent = '';
  document.getElementById('reg-error').textContent = '';
}

async function doSignIn() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const err = document.getElementById('auth-error');
  err.textContent = '';
  const { error } = await sbClient.auth.signInWithPassword({ email, password });
  if (error) { err.textContent = error.message; }
}

async function doSignUp() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const err = document.getElementById('reg-error');
  err.textContent = '';
  if (!name) { err.textContent = 'Please enter your name.'; return; }
  const { data, error } = await sbClient.auth.signUp({ email, password });
  if (error) { err.textContent = error.message; return; }
  if (data.user) {
    const role = ADMIN_EMAILS.includes(email) ? 'admin' : 'user';
    await sbClient.from('td_profiles').insert({ id: data.user.id, name, role });
  }
}

async function doSignOut() {
  await sbClient.auth.signOut();
  currentUser = null;
}

async function onAuthReady(user) {
  hideAuthOverlay();
  currentUser = user;
  // Show admin tab if admin
  if (ADMIN_EMAILS.includes(user.email)) {
    const adminTab = document.getElementById('nav-tab-admin');
    if (adminTab) adminTab.style.display = '';
  }
  // Populate user pill
  const { data: profile } = await sbClient.from('td_profiles').select('name').eq('id', user.id).single();
  if (profile) {
    document.getElementById('user-avatar').textContent = profile.name.charAt(0).toUpperCase();
    document.getElementById('user-name').textContent = profile.name;
  }
  document.getElementById('user-pill').style.display = 'flex';
  // Run first-login migration then pull from Supabase
  migrateLocalStorage(user.id);
  await pullFromSupabase(user.id);
  // Start periodic sync
  syncToSupabase();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncToSupabase(); });
  setInterval(syncToSupabase, 5 * 60 * 1000);
  // Re-init data that reads from localStorage
  watchlist = JSON.parse(localStorage.getItem(tdKey('td_watchlist')) || '[]');
  renderWatchlist();
  trades = JSON.parse(localStorage.getItem(tdKey('td_trades')) || '[]');
  renderTradeLog();
  renderJournalStats();
}

async function initAuth() {
  sbClient = window.supabase.createClient(SB_URL, SB_KEY);
  const { data: { session } } = await sbClient.auth.getSession();
  if (session) { await onAuthReady(session.user); }
  else { showAuthOverlay(); }
  sbClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN') { await onAuthReady(session.user); }
    else if (event === 'SIGNED_OUT') { currentUser = null; showAuthOverlay(); }
  });
}

document.addEventListener('DOMContentLoaded', initAuth);
```

- [ ] **Step 2: Verify**

Open `index.html` in Chrome. Enter your email and password. On successful sign-in: overlay hides, user pill appears in header with your initial. Check DevTools Console for errors.

- [ ] **Step 3: Verify sign out**

In Console, run `doSignOut()`. Overlay should reappear.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add auth JS — initAuth, doSignIn, doSignUp, doSignOut, onAuthReady"
```

---

### Task 5: User-Keyed localStorage + Migration

**Files:**
- Modify: `index.html` — `<script>` block, all localStorage reads/writes for personal keys

- [ ] **Step 1: Add `tdKey()` helper and migration function**

Add directly after the constants block (after `let sbClient = null, currentUser = null;`):

```js
// Returns user-keyed localStorage key. Call only after login.
function tdKey(base) {
  return currentUser ? base + '_' + currentUser.id : base;
}

// One-time migration: copies unkeyed keys to user-keyed on first login
function migrateLocalStorage(userId) {
  const PERSONAL_KEYS = [
    'td_trades','td_paper','td_watchlist','td_quiz_history',
    'td_kb_mastery','td_kb_tags','td_strategy_notes',
    'td_flashcard_weak','td_lib_watched'
  ];
  PERSONAL_KEYS.forEach(key => {
    const val = localStorage.getItem(key);
    if (val !== null) {
      localStorage.setItem(key + '_' + userId, val);
      localStorage.removeItem(key);
    }
  });
}
```

- [ ] **Step 2: Update watchlist localStorage reads/writes**

Find (line ~1393):
```js
let watchlist = JSON.parse(localStorage.getItem('td_watchlist') || '[]');
function saveWatchlist() { localStorage.setItem('td_watchlist', JSON.stringify(watchlist)); }
```
Replace with:
```js
let watchlist = [];
function saveWatchlist() { localStorage.setItem(tdKey('td_watchlist'), JSON.stringify(watchlist)); }
```
(watchlist is loaded in `onAuthReady` after migration runs)

- [ ] **Step 3: Update trade journal localStorage reads/writes**

Find (line ~1479):
```js
let trades = JSON.parse(localStorage.getItem('td_trades') || '[]');
function saveTrades() { localStorage.setItem('td_trades', JSON.stringify(trades)); }
```
Replace with:
```js
let trades = [];
function saveTrades() { localStorage.setItem(tdKey('td_trades'), JSON.stringify(trades)); }
```

- [ ] **Step 4: Update paper trade localStorage reads/writes**

Find:
```js
const paper = JSON.parse(localStorage.getItem('td_paper') || '{}');
```
Replace with:
```js
const paper = JSON.parse(localStorage.getItem(tdKey('td_paper')) || '{}');
```

Find all `localStorage.setItem('td_paper',` and `localStorage.getItem('td_paper')` in the paper trade section and replace with `tdKey('td_paper')`.

- [ ] **Step 5: Update quiz history localStorage reads/writes**

Find (line ~3074):
```js
_quizHistory = JSON.parse(localStorage.getItem('td_quiz_history') || '[]');
```
Replace with:
```js
_quizHistory = JSON.parse(localStorage.getItem(tdKey('td_quiz_history')) || '[]');
```

Find any `localStorage.setItem('td_quiz_history',` and replace with `localStorage.setItem(tdKey('td_quiz_history'),`.

- [ ] **Step 6: Update remaining personal keys**

Search for each of these and replace with `tdKey(...)` equivalents:
- `td_kb_mastery` → `tdKey('td_kb_mastery')`
- `td_kb_tags` → `tdKey('td_kb_tags')`
- `td_strategy_notes` → `tdKey('td_strategy_notes')`
- `td_flashcard_weak` → `tdKey('td_flashcard_weak')`
- `td_lib_watched` → `tdKey('td_lib_watched')`

Leave these untouched (device-level, not per-user):
- `td_finnhub_key`
- `td_anthropic_key`
- `td_yt_key`

- [ ] **Step 7: Verify**

Sign in. Open DevTools → Application → Local Storage. All personal keys should appear with `_<userId>` suffix (e.g. `td_trades_abc-123`). Log a test trade — confirm it saves with user-keyed key. Sign out, sign back in — data persists.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat: user-keyed localStorage + first-login migration"
```

---

### Task 6: Supabase Sync (Stats + Trade Journal)

**Files:**
- Modify: `index.html` — `<script>` block, add after `onAuthReady`

- [ ] **Step 1: Add paper stats computation helper**

```js
function computePaperStats() {
  const paper = JSON.parse(localStorage.getItem(tdKey('td_paper')) || '{}');
  const days = (paper.days || []).filter(d => d && d !== 'future' && typeof d === 'object');
  const trades_count = days.length;
  const wins = days.filter(d => d.pnl > 0).length;
  const pnl = days.reduce((sum, d) => sum + (d.pnl || 0), 0);
  const win_rate = trades_count > 0 ? Math.round((wins / trades_count) * 100) : 0;
  return { pnl: Math.round(pnl * 100) / 100, win_rate, trades_count };
}
```

- [ ] **Step 2: Add `syncToSupabase()`**

```js
async function syncToSupabase() {
  if (!currentUser || !sbClient) return;
  try {
    // Sync paper stats
    const stats = computePaperStats();
    await sbClient.from('td_user_stats').upsert({
      user_id: currentUser.id,
      paper_pnl: stats.pnl,
      paper_win_rate: stats.win_rate,
      paper_trades_count: stats.trades_count,
      last_synced: new Date().toISOString()
    });
    // Sync trade journal — insert new entries only
    const localTrades = JSON.parse(localStorage.getItem(tdKey('td_trades')) || '[]');
    if (localTrades.length === 0) return;
    const { data: existing } = await sbClient
      .from('td_journal_trades')
      .select('date,symbol,entry,exit_price,shares')
      .eq('user_id', currentUser.id);
    const existingKeys = new Set((existing || []).map(r =>
      `${r.date}|${r.symbol}|${r.entry}|${r.exit_price}|${r.shares}`
    ));
    const toInsert = localTrades
      .filter(t => !existingKeys.has(`${t.date}|${t.symbol}|${t.entry}|${t.exit}|${t.shares}`))
      .map(t => ({
        user_id: currentUser.id,
        date: t.date, symbol: t.symbol, dir: t.dir,
        entry: t.entry, exit_price: t.exit, shares: t.shares,
        pnl: t.pnl, pnl_pct: t.pnlPct,
        setup: t.setup || '', notes: t.notes || ''
      }));
    if (toInsert.length > 0) {
      await sbClient.from('td_journal_trades').insert(toInsert);
    }
  } catch(e) { console.warn('Sync error:', e); }
}
```

- [ ] **Step 3: Add `pullFromSupabase()`**

```js
async function pullFromSupabase(userId) {
  if (!sbClient) return;
  try {
    // Pull trade journal from Supabase into localStorage (cross-device restore)
    const { data: remoteTrades } = await sbClient
      .from('td_journal_trades')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (remoteTrades && remoteTrades.length > 0) {
      const mapped = remoteTrades.map(r => ({
        date: r.date, symbol: r.symbol, dir: r.dir,
        entry: r.entry, exit: r.exit_price, shares: r.shares,
        pnl: r.pnl, pnlPct: r.pnl_pct,
        setup: r.setup || '', notes: r.notes || ''
      }));
      // Merge: local + remote, deduplicate by key
      const local = JSON.parse(localStorage.getItem(tdKey('td_trades')) || '[]');
      const seen = new Set(local.map(t => `${t.date}|${t.symbol}|${t.entry}|${t.exit}|${t.shares}`));
      const merged = [...local, ...mapped.filter(t =>
        !seen.has(`${t.date}|${t.symbol}|${t.entry}|${t.exit}|${t.shares}`)
      )];
      localStorage.setItem(tdKey('td_trades'), JSON.stringify(merged));
    }
  } catch(e) { console.warn('Pull error:', e); }
}
```

- [ ] **Step 4: Verify**

Sign in. Open DevTools Console and run `syncToSupabase()`. Check Supabase → Table Editor → `td_user_stats` — a row should appear for your user. Log a trade in the journal, run `syncToSupabase()` again, check `td_journal_trades` for a new row.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add syncToSupabase and pullFromSupabase"
```

---

### Task 7: Nav Tabs — Leaderboard + Admin

**Files:**
- Modify: `index.html` — `<nav>` block (line ~489)

- [ ] **Step 1: Add Leaderboard and Admin tabs to nav**

Find `</nav>` and replace the entire `<nav>` block with:

```html
<nav>
  <div class="tab active" data-tab="today">🌅 Today</div>
  <div class="tab" data-tab="charts">📊 Charts</div>
  <div class="tab" data-tab="calc">🧮 Position Calc</div>
  <div class="tab" data-tab="journal">📓 P&L Journal</div>
  <div class="tab" data-tab="paper">🎯 Paper Trade</div>
  <div class="tab" data-tab="news">🗞 Live News</div>
  <div class="tab" data-tab="classroom">🎓 Classroom</div>
  <div class="tab" data-tab="learn">📚 Study</div>
  <div class="tab" data-tab="library">📁 Library</div>
  <div class="tab" data-tab="leaderboard">🏆 Leaderboard</div>
  <div class="tab" id="nav-tab-admin" data-tab="admin" style="display:none">🛡️ Admin</div>
</nav>
```

- [ ] **Step 2: Verify**

Open `index.html`. After signing in, Library and Leaderboard tabs appear in nav. Admin tab is hidden for regular users, visible for `nikkimasani@gmail.com`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add Leaderboard and Admin nav tabs"
```

---

### Task 8: Leaderboard Panel

**Files:**
- Modify: `index.html` — CSS `<style>` block and HTML panels section

- [ ] **Step 1: Add leaderboard CSS**

Add before `</style>`:

```css
/* ===================== LEADERBOARD PANEL ===================== */
#panel-leaderboard { overflow-y:auto; padding:20px; }
.lb-table { width:100%; border-collapse:collapse; }
.lb-table th { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; color:var(--muted); padding:8px 12px; text-align:left; border-bottom:1px solid var(--border); }
.lb-table td { padding:12px; border-bottom:1px solid var(--border); font-size:13px; }
.lb-table tr:hover td { background:var(--surface2); }
.lb-rank { font-weight:800; color:var(--muted); width:40px; }
.lb-pnl-pos { color:var(--accent2); font-weight:700; }
.lb-pnl-neg { color:var(--warn); font-weight:700; }
```

- [ ] **Step 2: Add leaderboard panel HTML**

Find the last `</div>` before `</div>` closing `.content` (after all other panels) and add before it:

```html
<!-- ===== LEADERBOARD ===== -->
<div class="panel" id="panel-leaderboard">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <div>
      <div style="font-size:20px;font-weight:800">🏆 Leaderboard</div>
      <div style="font-size:13px;color:var(--muted);margin-top:2px">Paper trade performance — ranked by P&L</div>
    </div>
    <button class="btn-sm" onclick="loadLeaderboard()">↺ Refresh</button>
  </div>
  <div id="leaderboard-table"><div style="color:var(--muted);font-size:13px">Loading...</div></div>
</div>
```

- [ ] **Step 3: Add leaderboard JS**

Add in the `<script>` block (after sync functions):

```js
// ==================== LEADERBOARD ====================
async function loadLeaderboard() {
  const container = document.getElementById('leaderboard-table');
  if (!container || !sbClient) return;
  container.innerHTML = '<div style="color:var(--muted);font-size:13px">Loading...</div>';
  try {
    const { data, error } = await sbClient
      .from('td_user_stats')
      .select('paper_pnl, paper_win_rate, paper_trades_count, last_synced, td_profiles(name)')
      .order('paper_pnl', { ascending: false });
    if (error || !data || data.length === 0) {
      container.innerHTML = '<div style="color:var(--muted);font-size:13px">No data yet — keep trading!</div>';
      return;
    }
    const medals = ['🥇','🥈','🥉'];
    container.innerHTML = `
      <table class="lb-table">
        <thead><tr>
          <th class="lb-rank">#</th>
          <th>Name</th>
          <th>Paper P&L</th>
          <th>Win Rate</th>
          <th>Trades</th>
        </tr></thead>
        <tbody>
          ${data.map((row, i) => {
            const pnl = row.paper_pnl || 0;
            const pnlClass = pnl >= 0 ? 'lb-pnl-pos' : 'lb-pnl-neg';
            const pnlStr = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
            return `<tr>
              <td class="lb-rank">${medals[i] || (i+1)}</td>
              <td style="font-weight:600">${row.td_profiles?.name || 'Unknown'}</td>
              <td class="${pnlClass}">${pnlStr}</td>
              <td>${row.paper_win_rate || 0}%</td>
              <td>${row.paper_trades_count || 0}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch(e) {
    container.innerHTML = '<div style="color:var(--warn);font-size:13px">Error loading leaderboard.</div>';
  }
}
```

- [ ] **Step 4: Wire leaderboard load to tab switch**

Find `function switchTab(name)` and add inside it:

```js
if (name === 'leaderboard') loadLeaderboard();
```

- [ ] **Step 5: Verify**

Click the Leaderboard tab. After syncing stats (from Task 6), your name should appear with your paper P&L.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add Leaderboard tab and panel"
```

---

### Task 9: Admin Panel

**Files:**
- Modify: `index.html` — CSS `<style>` block, HTML panels, JS `<script>` block

- [ ] **Step 1: Add admin panel CSS**

Add before `</style>`:

```css
/* ===================== ADMIN PANEL ===================== */
#panel-admin { overflow-y:auto; padding:20px; }
.admin-table { width:100%; border-collapse:collapse; }
.admin-table th { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; color:var(--muted); padding:8px 12px; text-align:left; border-bottom:1px solid var(--border); }
.admin-table td { padding:12px; border-bottom:1px solid var(--border); font-size:13px; }
.admin-table tr:hover td { background:var(--surface2); }
.admin-badge { background:linear-gradient(135deg,var(--accent),#a78bfa); color:#0a0e17; font-size:9px; font-weight:800; padding:2px 6px; border-radius:4px; margin-left:6px; vertical-align:middle; }
```

- [ ] **Step 2: Add admin panel HTML**

Add after the leaderboard panel HTML (before closing `.content`):

```html
<!-- ===== ADMIN ===== -->
<div class="panel" id="panel-admin">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <div>
      <div style="font-size:20px;font-weight:800">🛡️ Admin Dashboard</div>
      <div style="font-size:13px;color:var(--muted);margin-top:2px">All members — paper trade stats synced in real time</div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn-sm" onclick="loadAdminPanel()">↺ Refresh</button>
      <button class="btn-sm" onclick="doSignOut()">Sign Out</button>
    </div>
  </div>
  <div id="admin-users-table"><div style="color:var(--muted);font-size:13px">Loading users...</div></div>
</div>
```

- [ ] **Step 3: Add admin panel JS**

```js
// ==================== ADMIN ====================
async function loadAdminPanel() {
  const container = document.getElementById('admin-users-table');
  if (!container || !sbClient) return;
  container.innerHTML = '<div style="color:var(--muted);font-size:13px">Loading...</div>';
  try {
    const { data: profiles } = await sbClient.from('td_profiles').select('id, name, role');
    const { data: stats } = await sbClient.from('td_user_stats').select('*');
    const statsMap = {};
    (stats || []).forEach(s => { statsMap[s.user_id] = s; });
    if (!profiles || profiles.length === 0) {
      container.innerHTML = '<div style="color:var(--muted);font-size:13px">No users yet.</div>';
      return;
    }
    container.innerHTML = `
      <table class="admin-table">
        <thead><tr>
          <th>Name</th>
          <th>Paper P&L</th>
          <th>Win Rate</th>
          <th>Trades</th>
          <th>Last Synced</th>
        </tr></thead>
        <tbody>
          ${profiles.map(p => {
            const s = statsMap[p.id] || {};
            const pnl = s.paper_pnl || 0;
            const pnlClass = pnl >= 0 ? 'lb-pnl-pos' : 'lb-pnl-neg';
            const pnlStr = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
            const lastSynced = s.last_synced ? new Date(s.last_synced).toLocaleDateString() : '—';
            return `<tr>
              <td style="font-weight:600">${p.name}${p.role==='admin'?'<span class="admin-badge">admin</span>':''}</td>
              <td class="${pnlClass}">${pnlStr}</td>
              <td>${s.paper_win_rate || 0}%</td>
              <td>${s.paper_trades_count || 0}</td>
              <td style="color:var(--muted);font-size:12px">${lastSynced}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch(e) {
    container.innerHTML = '<div style="color:var(--warn);font-size:13px">Error loading admin panel.</div>';
  }
}
```

- [ ] **Step 4: Wire admin load to tab switch**

Inside `switchTab(name)`, add:

```js
if (name === 'admin') loadAdminPanel();
```

- [ ] **Step 5: Verify**

Sign in as `nikkimasani@gmail.com`. Admin tab should be visible. Click it — table shows your user with stats.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add Admin panel"
```

---

### Task 10: Library Tab + File Access Guide

**Files:**
- Modify: `index.html` — CSS `<style>` block, HTML panels, JS `<script>` block

- [ ] **Step 1: Add library panel CSS**

Add before `</style>`:

```css
/* ===================== LIBRARY PANEL ===================== */
#panel-library { overflow-y:auto; padding:20px; }
.lib-step { display:flex; gap:14px; align-items:flex-start; margin-bottom:14px; }
.lib-step-num { width:26px; height:26px; background:var(--accent); color:#0a0e17; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; flex-shrink:0; }
.lib-file-list { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:10px; margin-top:16px; }
.lib-file-card { background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:12px; display:flex; justify-content:space-between; align-items:center; gap:10px; }
.lib-file-name { font-size:13px; font-weight:600; color:var(--text); word-break:break-word; }
.lib-file-ext { font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-top:2px; }
```

- [ ] **Step 2: Add library panel HTML**

Add after the admin panel HTML (before closing `.content`):

```html
<!-- ===== LIBRARY ===== -->
<div class="panel" id="panel-library">
  <div style="margin-bottom:20px">
    <div style="font-size:20px;font-weight:800">📁 My Library</div>
    <div style="font-size:13px;color:var(--muted);margin-top:2px">Access your trading study materials</div>
  </div>

  <!-- Shared folder guide -->
  <div style="background:rgba(96,180,255,.06);border:1px solid rgba(96,180,255,.2);border-radius:10px;padding:20px;margin-bottom:20px">
    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:var(--accent);margin-bottom:12px">📂 Accessing the Shared TradeLab Folder</div>
    <div style="font-size:13px;color:var(--muted);line-height:1.7;margin-bottom:16px">The shared trading study materials are hosted in a OneDrive folder. Follow these steps to get everything working on your device:</div>
    <div class="lib-step">
      <div class="lib-step-num">1</div>
      <div><div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px">Open the shared folder</div><div style="font-size:12px;color:var(--muted)">Click the button below to open the OneDrive folder in your browser.</div></div>
    </div>
    <div class="lib-step">
      <div class="lib-step-num">2</div>
      <div><div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px">Download the folder</div><div style="font-size:12px;color:var(--muted)">In OneDrive, click <strong style="color:var(--text)">Download</strong> at the top. Extract the ZIP to a local folder (e.g. <code style="color:var(--accent);font-size:11px">Documents/TradeLab</code>).</div></div>
    </div>
    <div class="lib-step">
      <div class="lib-step-num">3</div>
      <div><div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px">Connect your local folder</div><div style="font-size:12px;color:var(--muted)">Scroll down and click <strong style="color:var(--text)">Connect My Folder</strong>. Select the folder you extracted. Every file gets an <strong style="color:var(--text)">Open →</strong> button.</div></div>
    </div>
    <a class="btn-sm" href="https://1drv.ms/f/c/12dc5ef91903e837/IgCuGsSk0pT8QZePQcCk0KqMAabt82BPPGaT50UjMVVZZx4?e=zczhsp" target="_blank" style="display:inline-block;text-decoration:none;margin-top:4px">📂 Open Shared TradeLab Folder →</a>
  </div>

  <!-- Connect local folder -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px">
    <div style="font-size:13px;font-weight:700;margin-bottom:6px">Connect My Local Folder</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px">Works in Chrome and Edge. Select the folder you downloaded and extracted.</div>
    <button class="btn-sm" onclick="connectLibraryFolder()">📁 Connect My Folder</button>
  </div>

  <div id="lib-file-list"></div>
</div>
```

- [ ] **Step 3: Add library JS**

```js
// ==================== LIBRARY ====================
let _libDirHandle = null;

async function connectLibraryFolder() {
  try {
    _libDirHandle = await window.showDirectoryPicker();
    await renderLibraryFiles();
  } catch(e) {
    if (e.name !== 'AbortError') alert('Could not open folder: ' + e.message);
  }
}

async function renderLibraryFiles() {
  const container = document.getElementById('lib-file-list');
  if (!_libDirHandle || !container) return;
  const files = [];
  for await (const [name, handle] of _libDirHandle) {
    if (handle.kind === 'file') files.push({ name, handle });
  }
  files.sort((a,b) => a.name.localeCompare(b.name));
  if (files.length === 0) {
    container.innerHTML = '<div style="color:var(--muted);font-size:13px">No files found in this folder.</div>';
    return;
  }
  container.innerHTML = '<div class="lib-file-list">' + files.map(f => {
    const ext = f.name.split('.').pop().toUpperCase();
    return `<div class="lib-file-card">
      <div>
        <div class="lib-file-name">${f.name}</div>
        <div class="lib-file-ext">${ext}</div>
      </div>
      <button class="btn-sm" onclick="openLibFile('${f.name}')">Open →</button>
    </div>`;
  }).join('') + '</div>';
}

async function openLibFile(name) {
  if (!_libDirHandle) return;
  try {
    const handle = await _libDirHandle.getFileHandle(name);
    const file = await handle.getFile();
    const url = URL.createObjectURL(file);
    window.open(url, '_blank');
  } catch(e) { alert('Could not open file: ' + e.message); }
}
```

- [ ] **Step 4: Verify**

Click Library tab. The 3-step guide appears with the "Open Shared TradeLab Folder" button. Click "Connect My Folder", select any local folder — files appear as cards with Open buttons.

- [ ] **Step 5: Commit + Push**

```bash
git add index.html
git commit -m "feat: add Library tab with OneDrive guide and local folder connector"
git push
```

Vercel auto-deploys in ~30 seconds. Test the live site at https://nikkis-tradehub.vercel.app.

---

### Post-Deployment Verification Checklist

- [ ] Auth overlay appears on first load (no session)
- [ ] Sign Up creates a row in `td_profiles` in Supabase
- [ ] Sign In restores session, hides overlay, shows user pill
- [ ] Admin tab visible only for `nikkimasani@gmail.com`
- [ ] All localStorage keys have `_<userId>` suffix after login
- [ ] Logging a trade saves to localStorage and syncs to `td_journal_trades`
- [ ] Leaderboard shows all users ranked by paper P&L
- [ ] Library "Open Shared Folder" button opens the OneDrive link
- [ ] Library "Connect My Folder" shows local files with Open buttons
- [ ] Sign Out shows auth overlay again; data reloads on next sign in
