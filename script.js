// ==================== SUPABASE SYNC ====================
const _sbClient = supabase.createClient(
  'https://bazjlrualnmbanmhiuau.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhempscnVhbG5tYmFubWhpdWF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MTkyNDQsImV4cCI6MjA5MTA5NTI0NH0.R8f7yEhxVHIcjwSS3H1b3tLj5jpuRP1pR4jiyVFEbmE'
);

function dbSet(key, value) {
  const stored = typeof value === 'string' ? value : JSON.stringify(value);
  localStorage.setItem(key, stored);
  const dbVal = typeof value === 'string' ? value : value;
  _sbClient.from('user_data').upsert({ key, value: dbVal, updated_at: new Date().toISOString() }).then(() => {});
}

function dbRemove(key) {
  localStorage.removeItem(key);
  _sbClient.from('user_data').delete().eq('key', key).then(() => {});
}

async function dbInit() {
  try {
    const { data, error } = await _sbClient.from('user_data').select('*');
    if (error || !data || !data.length) return;
    data.forEach(row => {
      const val = (row.value !== null && typeof row.value === 'object') ? JSON.stringify(row.value) : row.value;
      localStorage.setItem(row.key, val);
    });
    // Re-render all components with synced data
    watchlist = JSON.parse(localStorage.getItem('td_watchlist') || '[]');
    renderWatchlist();
    trades = JSON.parse(localStorage.getItem('td_trades') || '[]');
    renderTradeLog(); renderJournalStats();
    paperData = JSON.parse(localStorage.getItem('td_paper') || 'null');
    renderPaperCalendar();
    clsNotes = JSON.parse(localStorage.getItem('td_cls_notes') || '[]');
    renderClsNotes();
    loadChecks();
    _quizHistory = JSON.parse(localStorage.getItem('td_quiz_history') || '[]');
    renderQuizHistory();
    const fKey = localStorage.getItem('td_finnhub_key');
    if (fKey) { const el = document.getElementById('finnhub-key'); if(el) el.value = fKey; loadNews(fKey); }
    const aKey = localStorage.getItem('td_anthropic_key');
    if (aKey) { const bar = document.getElementById('ai-key-bar'); if(bar) bar.style.display = 'none'; const inp = document.getElementById('anthropic-key'); if(inp) inp.value = aKey; }
    const ytKey = localStorage.getItem('td_yt_key');
    if (ytKey) { const el = document.getElementById('yt-api-key-inp'); if(el) el.value = ytKey; }
    // KB upgrades
    kbMastery = JSON.parse(localStorage.getItem('td_kb_mastery') || '{}');
    kbTags    = JSON.parse(localStorage.getItem('td_kb_tags')    || '{}');
    applyKbState();
    strategyNotes = JSON.parse(localStorage.getItem('td_strategy_notes') || '[]');
    renderStrategyNotes();
    _fcWeakSpots = JSON.parse(localStorage.getItem('td_flashcard_weak') || '[]');
    // Sync library watched state
    _libWatched = JSON.parse(localStorage.getItem('td_lib_watched') || '{}');
    updateLibProgress();
  } catch(e) {
    console.warn('Supabase sync failed, using localStorage only:', e);
  }
}

// ==================== TABS ====================
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

// ==================== CLOCK & MARKET STATUS ====================
function updateClock() {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const h = et.getHours(), m = et.getMinutes(), s = et.getSeconds();
  const ampm = h >= 12 ? 'PM' : 'AM';
  document.getElementById('clock').textContent =
    `${String((h%12)||12).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} ${ampm} ET`;
  const day = et.getDay(), totalMin = h*60+m;
  const el = document.getElementById('market-status');
  if (day===0||day===6) { el.textContent='● Weekend'; el.className='market-closed'; }
  else if (totalMin>=570&&totalMin<960) { el.textContent='● Market Open'; el.className='market-open'; }
  else if (totalMin>=240&&totalMin<570) { el.textContent='● Pre-Market'; el.className='market-pre'; }
  else if (totalMin>=960&&totalMin<1200) { el.textContent='● After-Hours'; el.className='market-pre'; }
  else { el.textContent='● Market Closed'; el.className='market-closed'; }
}
setInterval(updateClock, 1000);
updateClock();

// ==================== TRADINGVIEW CHART ====================
let currentSymbol = 'AAPL', currentInterval = '5';
function loadChart() {
  const sym = document.getElementById('chart-symbol').value.trim().toUpperCase() || 'AAPL';
  currentSymbol = sym;
  renderChart();
}
function renderChart() {
  const container = document.getElementById('tv-widget');
  container.innerHTML = '';
  const s = document.createElement('script');
  s.type = 'text/javascript';
  s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  s.async = true;
  s.innerHTML = JSON.stringify({
    autosize:true, symbol:currentSymbol, interval:currentInterval,
    timezone:'America/New_York', theme:'dark', style:'1', locale:'en',
    enable_publishing:false, withdateranges:true, hide_side_toolbar:false,
    allow_symbol_change:true, studies:['STD;VWAP','STD;EMA'], container_id:'tv-widget'
  });
  container.appendChild(s);
  document.getElementById('chart-symbol').value = currentSymbol;
}
document.querySelectorAll('.interval-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.interval-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentInterval = btn.dataset.interval;
    renderChart();
  });
});
document.getElementById('chart-symbol').addEventListener('keydown', e => { if(e.key==='Enter') loadChart(); });
renderChart();

// ==================== WATCHLIST ====================
let watchlist = JSON.parse(localStorage.getItem('td_watchlist') || '[]');
function saveWatchlist() { dbSet('td_watchlist', watchlist); }
function renderWatchlist() {
  const c = document.getElementById('watchlist-items');
  if (!watchlist.length) { c.innerHTML='<div style="font-size:12px;color:var(--muted);padding:4px 0">Add tickers above</div>'; return; }
  c.innerHTML = watchlist.map((w,i) => `
    <div class="watchlist-item" onclick="loadSymbol('${w.sym}')">
      <div><div class="ticker-sym">${w.sym}</div></div>
      <button class="del-btn" onclick="event.stopPropagation();removeTicker(${i})">×</button>
    </div>`).join('');
}
function addTicker() {
  const inp = document.getElementById('ticker-input');
  const sym = inp.value.trim().toUpperCase();
  if (!sym || watchlist.find(w=>w.sym===sym)) { inp.value=''; return; }
  watchlist.push({sym});
  saveWatchlist(); renderWatchlist(); inp.value='';
}
function removeTicker(i) { watchlist.splice(i,1); saveWatchlist(); renderWatchlist(); }
function loadSymbol(sym) {
  currentSymbol = sym;
  document.getElementById('chart-symbol').value = sym;
  renderChart();
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelector('[data-tab="charts"]').classList.add('active');
  document.getElementById('panel-charts').classList.add('active');
}
document.getElementById('ticker-input').addEventListener('keydown', e=>{ if(e.key==='Enter') addTicker(); });
renderWatchlist();

// ==================== POSITION SIZE CALCULATOR ====================
function calcPosition() {
  const account = parseFloat(document.getElementById('calc-account').value) || 0;
  const riskPct = parseFloat(document.getElementById('calc-risk-pct').value) || 0;
  const entry   = parseFloat(document.getElementById('calc-entry').value) || 0;
  const stop    = parseFloat(document.getElementById('calc-stop').value) || 0;
  const target  = parseFloat(document.getElementById('calc-target').value) || 0;

  if (!account || !riskPct || !entry || !stop || entry === stop) {
    return;
  }

  const dollarRisk = account * (riskPct / 100);
  const stopDist   = Math.abs(entry - stop);
  const shares     = Math.floor(dollarRisk / stopDist);
  const posValue   = shares * entry;
  const pctAccount = (posValue / account) * 100;

  document.getElementById('res-dollar-risk').textContent   = `$${dollarRisk.toFixed(2)}`;
  document.getElementById('res-shares').textContent        = shares.toLocaleString();
  document.getElementById('res-position-value').textContent = `$${posValue.toFixed(2)}`;
  document.getElementById('res-pct-account').textContent   = `${pctAccount.toFixed(1)}%`;

  if (target && target !== entry) {
    const reward   = Math.abs(target - entry);
    const rr       = reward / stopDist;
    const profit   = shares * reward;
    const rrPct    = Math.min((rr / 4) * 100, 100);
    document.getElementById('res-rr').textContent     = `1 : ${rr.toFixed(2)}`;
    document.getElementById('res-profit').textContent = `$${profit.toFixed(2)}`;
    document.getElementById('res-rr-bar').style.width  = rrPct + '%';
    document.getElementById('res-rr-bar').style.background = rr >= 2 ? 'var(--accent2)' : rr >= 1 ? 'var(--gold)' : 'var(--warn)';
  } else {
    document.getElementById('res-rr').textContent = '—';
    document.getElementById('res-profit').textContent = '—';
  }

  // Rule checker
  const rules = [];
  if (riskPct <= 1) rules.push(`✅ Risk ${riskPct}% — within 1% rule`);
  else if (riskPct <= 2) rules.push(`⚠️ Risk ${riskPct}% — acceptable but max out`);
  else rules.push(`❌ Risk ${riskPct}% — too high for a beginner`);

  if (posValue <= account) rules.push(`✅ Position $${posValue.toFixed(0)} fits in account`);
  else rules.push(`❌ Position exceeds account size`);

  if (target) {
    const rr = Math.abs(target - entry) / stopDist;
    if (rr >= 2) rules.push(`✅ R:R ${rr.toFixed(2)} — meets 1:2 minimum`);
    else if (rr >= 1) rules.push(`⚠️ R:R ${rr.toFixed(2)} — below ideal 1:2 minimum`);
    else rules.push(`❌ R:R ${rr.toFixed(2)} — risk exceeds reward. Skip this trade.`);
  }

  document.getElementById('risk-rules').innerHTML = rules.map(r=>`<div>${r}</div>`).join('');
}
calcPosition();

// ==================== P&L JOURNAL ====================
let trades = JSON.parse(localStorage.getItem('td_trades') || '[]');
function saveTrades() { dbSet('td_trades', trades); }

function logTrade() {
  const date     = document.getElementById('tj-date').value.trim();
  const symbol   = document.getElementById('tj-symbol').value.trim().toUpperCase();
  const dir      = document.getElementById('tj-direction').value;
  const entry    = parseFloat(document.getElementById('tj-entry').value);
  const exit     = parseFloat(document.getElementById('tj-exit').value);
  const shares   = parseInt(document.getElementById('tj-shares').value);
  const setup    = document.getElementById('tj-setup').value.trim();
  const notes    = document.getElementById('tj-notes').value.trim();

  if (!symbol || !entry || !exit || !shares) {
    alert('Please fill in Symbol, Entry, Exit, and Shares.');
    return;
  }

  const rawPnl = dir === 'Long'
    ? (exit - entry) * shares
    : (entry - exit) * shares;
  const pnlPct = dir === 'Long'
    ? ((exit - entry) / entry) * 100
    : ((entry - exit) / entry) * 100;

  trades.unshift({ date: date || new Date().toLocaleDateString(), symbol, dir, entry, exit, shares, pnl: rawPnl, pnlPct, setup, notes });
  saveTrades();
  renderTradeLog();
  renderJournalStats();

  // Clear form
  ['tj-date','tj-symbol','tj-entry','tj-exit','tj-shares','tj-setup','tj-notes'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

function deleteTrade(i) {
  if (!confirm('Delete this trade?')) return;
  trades.splice(i, 1);
  saveTrades();
  renderTradeLog();
  renderJournalStats();
}

function renderTradeLog() {
  const tbody = document.getElementById('trade-log-body');
  if (!trades.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty-state">No trades logged yet.</td></tr>';
    return;
  }
  tbody.innerHTML = trades.map((t,i) => `
    <tr>
      <td>${t.date}</td>
      <td style="font-weight:700;color:var(--accent)">${t.symbol}</td>
      <td><span class="${t.dir==='Long'?'dir-long':'dir-short'}">${t.dir}</span></td>
      <td>$${parseFloat(t.entry).toFixed(2)}</td>
      <td>$${parseFloat(t.exit).toFixed(2)}</td>
      <td>${t.shares}</td>
      <td class="${t.pnl>=0?'pnl-pos':'pnl-neg'}">${t.pnl>=0?'+':''}$${parseFloat(t.pnl).toFixed(2)}</td>
      <td class="${t.pnlPct>=0?'pnl-pos':'pnl-neg'}">${t.pnlPct>=0?'+':''}${parseFloat(t.pnlPct).toFixed(2)}%</td>
      <td style="color:var(--muted)">${t.setup||'—'}</td>
      <td style="color:var(--muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.notes||'—'}</td>
      <td><button class="del-btn" onclick="deleteTrade(${i})">×</button></td>
    </tr>`).join('');
}

function renderJournalStats() {
  if (!trades.length) return;
  const totalPnl = trades.reduce((s,t) => s + parseFloat(t.pnl), 0);
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  const winRate = (wins.length / trades.length) * 100;
  const avgWin = wins.length ? wins.reduce((s,t)=>s+t.pnl,0)/wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s,t)=>s+t.pnl,0)/losses.length) : 0;
  const pf = avgLoss > 0 ? ((avgWin * wins.length) / (avgLoss * losses.length)).toFixed(2) : '∞';

  const pnlEl = document.getElementById('stat-total-pnl');
  pnlEl.textContent = `${totalPnl>=0?'+':''}$${totalPnl.toFixed(2)}`;
  pnlEl.style.color = totalPnl >= 0 ? 'var(--accent2)' : 'var(--warn)';
  document.getElementById('stat-winrate').textContent = `${winRate.toFixed(1)}%`;
  document.getElementById('stat-trades').textContent = trades.length;
  document.getElementById('stat-pf').textContent = pf;
}

renderTradeLog();
renderJournalStats();

// Set today's date as default for journal form
document.getElementById('tj-date').value = new Date().toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric'});

// ==================== FINNHUB NEWS ====================

// --- Keyword scoring engine ---
const NEWS_CATEGORIES = [
  {
    key: 'fed',
    label: 'FED / MACRO',
    impact: 'HIGH',
    terms: ['federal reserve','fed ','fomc','rate hike','rate cut','interest rate','inflation','cpi','pce','gdp','powell','yellen','recession','taper','quantitative','treasury yield','10-year','2-year','basis point'],
    score: 10
  },
  {
    key: 'earnings',
    label: 'EARNINGS',
    impact: 'HIGH',
    terms: ['earnings','beat','miss','eps','revenue','guidance','raised guidance','lowered guidance','quarterly results','profit','loss per share','analyst estimate'],
    score: 8
  },
  {
    key: 'ma',
    label: 'M&A / DEAL',
    impact: 'HIGH',
    terms: ['merger','acquisition','acquires','buyout','takeover','deal','stake','acquired by','bought by','going private'],
    score: 7
  },
  {
    key: 'biotech',
    label: 'BIOTECH / FDA',
    impact: 'HIGH',
    terms: ['fda','approval','approved','clinical trial','drug','treatment','phase 2','phase 3','breakthrough','reject'],
    score: 7
  },
  {
    key: 'major',
    label: '🚨 BREAKING',
    impact: 'HIGH',
    terms: ['bankruptcy','default','collapse','crisis','crash','halt','suspended','sec charges','fraud','investigation','downgrade','upgrade','short seller'],
    score: 9
  },
  {
    key: 'market',
    label: 'MARKET MOVE',
    impact: 'MED',
    terms: ['surges','plunges','rallies','tumbles','soars','slides','spikes','all-time high','52-week','record high','record low','s&p 500','nasdaq','dow jones','market cap'],
    score: 5
  }
];

function scoreArticle(item) {
  const text = (item.headline + ' ' + (item.summary || '')).toLowerCase();
  let topScore = 0;
  let topCat = null;
  for (const cat of NEWS_CATEGORIES) {
    let score = 0;
    for (const term of cat.terms) {
      if (text.includes(term)) score += cat.score;
    }
    if (score > topScore) { topScore = score; topCat = cat; }
  }
  return { score: topScore, cat: topCat };
}

const savedKey = localStorage.getItem('td_finnhub_key') || '';
if (savedKey) document.getElementById('finnhub-key').value = savedKey;

function saveFinnhubKey() {
  const key = document.getElementById('finnhub-key').value.trim();
  if (!key) { alert('Enter your Finnhub API key'); return; }
  dbSet('td_finnhub_key', key);
  loadNews(key);
}

async function loadNews(key) {
  if (!key) return;
  const placeholder = document.getElementById('news-placeholder');
  const feedSection = document.getElementById('feed-section');
  placeholder.innerHTML = '<div class="news-loading">Loading live news...</div>';
  placeholder.style.display = 'block';
  feedSection.style.display = 'none';
  document.getElementById('highlights-zone').style.display = 'none';

  try {
    const res = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${key}`);
    if (!res.ok) throw new Error('Invalid API key or request failed');
    const data = await res.json();
    if (!data.length) {
      placeholder.innerHTML = '<div class="news-loading">No news available right now.</div>';
      return;
    }

    placeholder.style.display = 'none';

    // Score all articles
    const scored = data.map(item => ({ ...item, ...scoreArticle(item) }))
                       .sort((a, b) => b.score - a.score);

    // Highlights: top 5 with any category match
    const highlights = scored.filter(a => a.score > 0).slice(0, 5);

    // Full feed: all articles
    const allArticles = data;

    // Store highlights for AI brief
    _latestHighlights = highlights;

    // Render highlights
    if (highlights.length) {
      document.getElementById('highlights-zone').style.display = 'block';
      document.getElementById('highlights-count').textContent = highlights.length;
      // Restore AI key bar state
      if (!localStorage.getItem('td_anthropic_key')) {
        document.getElementById('ai-key-bar').style.display = 'flex';
      }
      document.getElementById('highlights-grid').innerHTML = highlights.map(item => {
        const ts = new Date(item.datetime * 1000).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
        const cat = item.cat;
        const impactClass = item.impact === 'HIGH' ? 'impact-high' : 'impact-med';
        const take = getTradingTake(item);
        return `
          <div class="highlight-card cat-${cat.key}">
            <div class="hc-tag cat-${cat.key}">${cat.label}</div>
            <div class="hc-headline"><a href="${item.url}" target="_blank">${item.headline}</a></div>
            <div class="hc-meta">
              <span>${item.source} · ${ts}</span>
              <span class="hc-impact ${impactClass}">${cat.impact} IMPACT</span>
            </div>
            ${take ? `<div class="hc-take">🎯 ${take}</div>` : ''}
          </div>`;
      }).join('');
    }

    // Render full feed
    feedSection.style.display = 'block';
    document.getElementById('feed-count').textContent = allArticles.length;
    document.getElementById('news-feed').innerHTML = allArticles.slice(0, 40).map(item => {
      const ts = new Date(item.datetime * 1000).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
      return `
        <div class="news-item">
          ${item.image ? `<img class="news-item-img" src="${item.image}" onerror="this.style.display='none'">` : ''}
          <div class="news-item-body">
            <div class="news-item-source">${item.source}</div>
            <div class="news-item-headline"><a href="${item.url}" target="_blank">${item.headline}</a></div>
            <div class="news-item-meta">${ts}</div>
          </div>
        </div>`;
    }).join('');

    // Timestamp
    const now = new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
    document.getElementById('news-last-updated').textContent = `Last updated ${now}`;

  } catch(e) {
    placeholder.style.display = 'block';
    placeholder.innerHTML = `<div class="news-loading">Error: ${e.message}.<br>Check your API key at <strong style="color:var(--accent)">finnhub.io</strong></div>`;
  }
}

if (savedKey) loadNews(savedKey);

// ==================== PRE-MARKET BRIEF ====================
function briefKey() {
  return 'td_brief_' + new Date().toISOString().split('T')[0];
}

function loadBrief() {
  const today = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  document.getElementById('brief-date-label').textContent = today;
  document.getElementById('brief-date-badge').textContent = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'});
  const saved = localStorage.getItem(briefKey()) || '';
  document.getElementById('brief-text').value = saved;
}

let briefSaveTimer = null;
function saveBrief() {
  clearTimeout(briefSaveTimer);
  briefSaveTimer = setTimeout(() => {
    dbSet(briefKey(), document.getElementById('brief-text').value);
    const msg = document.getElementById('brief-saved-msg');
    msg.style.display = 'inline';
    setTimeout(() => msg.style.display = 'none', 2000);
  }, 600);
}

function toggleBrief() {
  const body = document.getElementById('brief-body');
  const toggle = document.getElementById('brief-toggle');
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? 'block' : 'none';
  toggle.textContent = isHidden ? '▲' : '▼';
  if (isHidden) loadBrief();
}

function showPrevBriefs() {
  const container = document.getElementById('past-briefs-list');
  const isVisible = container.style.display !== 'none';
  if (isVisible) { container.style.display = 'none'; return; }

  const briefs = [];
  for (let i = 1; i <= 30; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = 'td_brief_' + d.toISOString().split('T')[0];
    const val = localStorage.getItem(key);
    if (val) briefs.push({ date: d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}), text: val });
  }

  if (!briefs.length) {
    container.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px">No past briefs found.</div>';
  } else {
    container.innerHTML = briefs.map(b => `
      <div style="margin-bottom:10px;padding:10px;background:var(--surface);border-radius:6px;border:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--accent);margin-bottom:4px">${b.date}</div>
        <div style="font-size:12px;color:var(--text);line-height:1.6;white-space:pre-wrap">${b.text}</div>
      </div>`).join('');
  }
  container.style.display = 'block';
}

loadBrief();

// ==================== TRADER'S TAKE + AI BRIEF ====================

// Rule-based plain-English trading implications per category
const TRADER_TAKES = {
  fed: [
    { terms: ['rate cut','cuts rate','lower rate','dovish','pivot'], take: '<strong>Rate cut signal:</strong> Cheaper borrowing usually boosts growth stocks (tech, small-caps). Watch QQQ and IWM for upside. Dollar may weaken.' },
    { terms: ['rate hike','raises rate','higher rate','hawkish','tightening'], take: '<strong>Rate hike signal:</strong> Higher rates pressure valuations — growth stocks often drop. Watch for rotation into financials and value. Bonds may sell off.' },
    { terms: ['cpi','inflation','pce'], take: '<strong>Inflation data:</strong> Hot inflation → Fed stays hawkish → market may sell off. Cool inflation → Fed may cut → market may rally. First 30 min reaction often reverses.' },
    { terms: ['gdp','recession','economic'], take: '<strong>Economic data:</strong> Weak GDP raises recession fears — defensives (utilities, staples) hold better. Strong GDP is bullish overall market sentiment.' },
    { terms: ['powell','fed chair','fomc'], take: '<strong>Fed Chair speaking:</strong> Watch every word. Markets react sharply to tone shifts. Wait for the reaction before trading — don\'t predict it.' },
  ],
  earnings: [
    { terms: ['beat','beats','topped','exceeded','above estimate'], take: '<strong>Earnings beat:</strong> Stock may gap up. Check pre-market price vs. prior close. If it gaps up more than 5%, the move may already be priced in — wait for a pullback.' },
    { terms: ['miss','missed','below estimate','disappoints','fell short'], take: '<strong>Earnings miss:</strong> Stock may gap down. Can bounce if selloff is overdone, but shorting the dead-cat bounce is a common strategy. High risk — wait for stabilization.' },
    { terms: ['guidance','raised guidance','outlook raised'], take: '<strong>Guidance raised:</strong> More important than the actual earnings beat. Raised guidance means management is confident — bullish signal for the stock and sometimes the sector.' },
    { terms: ['guidance lowered','cut guidance','reduced outlook'], take: '<strong>Guidance cut:</strong> Worst outcome. Even if earnings beat, lowered guidance causes selling. Avoid going long until the dust settles.' },
  ],
  ma: [
    { terms: ['acquires','acquisition','merger','buyout','deal'], take: '<strong>M&A news:</strong> Target company stock usually jumps toward offer price. Acquirer may dip (overpaying concerns). Watch for competing bids — can push price higher.' },
    { terms: ['takeover','going private'], take: '<strong>Takeover bid:</strong> Target stock jumps to near offer price. Spread between current price and offer = risk premium. Don\'t chase if spread is tiny.' },
  ],
  biotech: [
    { terms: ['fda','approved','approval'], take: '<strong>FDA approval:</strong> Major catalyst — stock can 20-100%+ on this news. High volatility, wide spreads. Use small size or avoid if you\'re a beginner.' },
    { terms: ['rejected','complete response','clinical hold'], take: '<strong>FDA rejection:</strong> Stock can drop 50-80% instantly. Never hold biotech through binary FDA events without understanding the risk.' },
    { terms: ['phase 3','clinical trial','results'], take: '<strong>Clinical trial data:</strong> Positive = big spike, negative = big drop. Binary event — no in-between. Sit this one out unless you follow biotech closely.' },
  ],
  major: [
    { terms: ['bankruptcy','chapter 11','default'], take: '<strong>Bankruptcy filing:</strong> Stock often drops to near zero. Existing shareholders usually get wiped out. Don\'t buy thinking it\'s cheap — it\'s not.' },
    { terms: ['short seller','fraud','investigation','sec'], take: '<strong>Fraud/SEC investigation:</strong> Stock can drop 30-60% on the open. High risk of further downside. Avoid until full picture is clear.' },
    { terms: ['downgrade'], take: '<strong>Analyst downgrade:</strong> Creates selling pressure. Watch if the stock holds key support after the initial drop — that\'s a sign institutions disagree with the downgrade.' },
    { terms: ['upgrade'], take: '<strong>Analyst upgrade:</strong> Creates buying momentum. Most powerful in early morning when there\'s less competing flow. Confirm with volume.' },
    { terms: ['halt','trading halt'], take: '<strong>Trading halt:</strong> Position cannot be entered or exited while halted. When it resumes, expect extreme volatility. Wait for the first 5-10 min candles to form before trading.' },
  ],
  market: [
    { terms: ['all-time high','record high','52-week high'], take: '<strong>New highs:</strong> Bullish momentum. Strong stocks make new highs then go higher — don\'t short strength. Look for pullbacks to VWAP as entries.' },
    { terms: ['record low','52-week low','plunge','crash'], take: '<strong>Sharp selloff:</strong> Panic selling creates oversold bounces. Wait for a base to form (10-15 min of sideways action) before buying a bounce.' },
    { terms: ['s&p 500','nasdaq','dow jones'], take: '<strong>Index move:</strong> Check SPY/QQQ pre-market to gauge overall market mood. Trading with the broad market trend dramatically improves individual stock trade odds.' },
  ]
};

function getTradingTake(item) {
  const text = (item.headline + ' ' + (item.summary || '')).toLowerCase();
  const catKey = item.cat?.key;
  if (!catKey || !TRADER_TAKES[catKey]) return null;
  for (const rule of TRADER_TAKES[catKey]) {
    if (rule.terms.some(t => text.includes(t))) return rule.take;
  }
  // Generic fallback per category
  const fallbacks = {
    fed:      '<strong>Fed/Macro news:</strong> Watch SPY/QQQ reaction at the open. Macro events set the tone for the whole day.',
    earnings: '<strong>Earnings news:</strong> Use the Position Calculator before trading — earnings stocks are more volatile and need tighter sizing.',
    ma:       '<strong>M&A news:</strong> Check if you hold the named stocks. M&A can be a one-day catalyst that quickly fades.',
    biotech:  '<strong>Biotech catalyst:</strong> Expect wide spreads and extreme moves. Use smaller size than usual.',
    major:    '<strong>High-impact event:</strong> Let price discovery happen in the first 15 minutes before committing to a direction.',
    market:   '<strong>Market-wide move:</strong> Check SPY direction before trading anything individual.',
  };
  return fallbacks[catKey] || null;
}

// Anthropic API key management
function saveAnthropicKey() {
  const key = document.getElementById('anthropic-key').value.trim();
  if (!key) { alert('Enter your Anthropic API key'); return; }
  dbSet('td_anthropic_key', key);
  document.getElementById('ai-key-bar').style.display = 'none';
  document.getElementById('ai-brief-btn').style.background = 'var(--accent2)';
  document.getElementById('ai-brief-btn').textContent = '🤖 Generate AI Brief';
}

// Load saved key state on init
(function initAnthropicKey() {
  const saved = localStorage.getItem('td_anthropic_key');
  if (saved) {
    document.getElementById('ai-key-bar').style.display = 'none';
    if (document.getElementById('anthropic-key')) document.getElementById('anthropic-key').value = saved;
  }
})();

// Store headlines for AI brief
let _latestHighlights = [];

async function generateAIBrief() {
  const btn = document.getElementById('ai-brief-btn');
  const section = document.getElementById('ai-brief-section');
  const content = document.getElementById('ai-brief-content');
  const key = localStorage.getItem('td_anthropic_key');

  section.style.display = 'block';

  if (!key) {
    // Rule-based fallback brief
    content.innerHTML = generateRuleBasedBrief();
    return;
  }

  // Claude API call
  btn.disabled = true;
  btn.textContent = '⏳ Analyzing...';
  content.innerHTML = `<div class="ai-brief-loading"><div class="ai-spinner"></div>Claude is reading the market news...</div>`;

  const headlines = _latestHighlights.map((h, i) => `${i+1}. [${h.cat?.label || 'NEWS'}] ${h.headline}`).join('\n');

  const prompt = `You are a trading coach explaining today's market news to a beginner day trader.

Today's top market-moving headlines:
${headlines}

Respond in exactly this JSON format (no markdown, just raw JSON):
{
  "mood": "One sentence: Is the overall market mood bullish, bearish, or mixed today and why?",
  "key_story": "One sentence: What is THE most important story and what does it mean in plain English (no jargon)?",
  "trading_implication": "One to two sentences: What does this mean for day traders today — what sectors or stocks might move, in which direction?",
  "watch_for": "One sentence: What is the single most important thing a beginner day trader should watch for or be careful about today?"
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-allow-browser': 'true',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${res.status}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse AI response');
    const brief = JSON.parse(jsonMatch[0]);

    content.innerHTML = `
      <div class="ai-brief-card">
        <div class="ai-brief-header">
          <span style="font-size:18px">🤖</span>
          <span class="ai-brief-header-title">AI Market Brief</span>
          <span class="ai-brief-header-model">Claude Haiku · ${new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span>
          <button class="btn-sm btn-ghost" style="margin-left:auto;font-size:11px;padding:3px 8px" onclick="generateAIBrief()">↻ Regenerate</button>
        </div>
        <div class="ai-brief-sections">
          <div class="ai-brief-section">
            <div class="ai-brief-section-label" style="color:var(--accent)">📊 Market Mood</div>
            <div class="ai-brief-section-text">${brief.mood}</div>
          </div>
          <div class="ai-brief-section">
            <div class="ai-brief-section-label" style="color:var(--gold)">🗞 Key Story</div>
            <div class="ai-brief-section-text">${brief.key_story}</div>
          </div>
          <div class="ai-brief-section">
            <div class="ai-brief-section-label" style="color:var(--accent2)">💹 Trading Implication</div>
            <div class="ai-brief-section-text">${brief.trading_implication}</div>
          </div>
          <div class="ai-brief-section">
            <div class="ai-brief-section-label" style="color:var(--warn)">👀 Watch For</div>
            <div class="ai-brief-section-text">${brief.watch_for}</div>
          </div>
        </div>
      </div>`;

  } catch(e) {
    if (e.message.includes('401') || e.message.includes('invalid')) {
      content.innerHTML = `<div class="ai-brief-card"><div style="font-size:13px;color:var(--warn)">❌ Invalid API key. <button class="btn-sm btn-ghost" style="font-size:11px" onclick="document.getElementById('ai-key-bar').style.display='flex';localStorage.removeItem('td_anthropic_key')">Reset Key</button></div></div>`;
    } else {
      // Fallback to rule-based
      content.innerHTML = generateRuleBasedBrief() + `<div style="font-size:11px;color:var(--muted);margin-top:6px">⚠️ API error (${e.message}) — showing rule-based brief instead.</div>`;
    }
  } finally {
    btn.disabled = false;
    btn.textContent = '🤖 Generate AI Brief';
  }
}

function generateRuleBasedBrief() {
  if (!_latestHighlights.length) return '';
  const cats = [...new Set(_latestHighlights.map(h => h.cat?.label).filter(Boolean))];
  const hasFed = _latestHighlights.some(h => h.cat?.key === 'fed');
  const hasEarnings = _latestHighlights.some(h => h.cat?.key === 'earnings');
  const hasMajor = _latestHighlights.some(h => h.cat?.key === 'major');

  let mood = hasMajor ? 'Volatile — high-impact events detected. Trade smaller size today.' :
             hasFed ? 'Macro-driven — Fed/economic news dominates. Wait for market direction to confirm before trading.' :
             hasEarnings ? 'Earnings-focused — individual stocks moving on results. News-driven opportunities.' :
             'Mixed signals — no single dominant theme. Focus on your pre-planned setups only.';

  let keyStory = _latestHighlights[0] ? `Top story: "${_latestHighlights[0].headline}" — categorized as ${_latestHighlights[0].cat?.label}.` : 'Multiple market stories in play.';

  let implication = cats.includes('FED / MACRO') ? 'Macro news affects the broad market — check SPY/QQQ direction before trading individual stocks. Trade with the trend, not against it.' :
                    cats.includes('EARNINGS') ? 'Earnings beats or misses can create gap-up or gap-down opens. Use the Position Calculator — volatile earnings stocks need smaller position sizes.' :
                    'Focus on your pre-planned setups. Avoid chasing news-driven moves unless you followed the stock pre-market.';

  let watchFor = hasMajor ? '🚨 High-impact event in play — use strict stops, size down, and avoid overtrading.' :
                 hasFed ? '📅 Economic event day — first 30 minutes after data release are highly volatile. Consider waiting for 9:45 AM before entering.' :
                 '📋 Stick to your watchlist. The best trade is often no trade when news is confusing.';

  return `<div class="ai-brief-card">
    <div class="ai-brief-header">
      <span style="font-size:18px">📋</span>
      <span class="ai-brief-header-title">Rule-Based Market Brief</span>
      <span class="ai-brief-header-model">Auto-generated · Add Anthropic key for AI version</span>
    </div>
    <div class="ai-brief-sections">
      <div class="ai-brief-section"><div class="ai-brief-section-label" style="color:var(--accent)">📊 Market Mood</div><div class="ai-brief-section-text">${mood}</div></div>
      <div class="ai-brief-section"><div class="ai-brief-section-label" style="color:var(--gold)">🗞 Key Story</div><div class="ai-brief-section-text">${keyStory}</div></div>
      <div class="ai-brief-section"><div class="ai-brief-section-label" style="color:var(--accent2)">💹 Trading Implication</div><div class="ai-brief-section-text">${implication}</div></div>
      <div class="ai-brief-section"><div class="ai-brief-section-label" style="color:var(--warn)">👀 Watch For</div><div class="ai-brief-section-text">${watchFor}</div></div>
    </div>
  </div>`;
}

// ==================== PAPER TRADE 90-DAY TRACKER ====================
let paperData = JSON.parse(localStorage.getItem('td_paper') || 'null');

function startPaperChallenge() {
  if (paperData && !confirm('A challenge is already running. Start a new one?')) return;
  paperData = { startDate: new Date().toISOString().split('T')[0], days: {} };
  dbSet('td_paper', paperData);
  renderPaperCalendar();
  document.getElementById('paper-start-btn').textContent = '✓ Challenge Running';
}

function resetPaperChallenge() {
  if (!confirm('Reset the 90-day challenge? All data will be lost.')) return;
  paperData = null;
  dbRemove('td_paper');
  renderPaperCalendar();
  document.getElementById('paper-start-btn').textContent = '🚀 Start 90-Day Challenge';
}

function logPaperDay() {
  if (!paperData) { alert('Start your 90-day challenge first!'); return; }
  const pnl = parseFloat(document.getElementById('paper-pnl').value) || 0;
  const count = parseInt(document.getElementById('paper-trades-count').value) || 0;
  const notes = document.getElementById('paper-notes').value.trim();
  const rules = ['rule1','rule2','rule3','rule4','rule5'].map(id => document.getElementById(id).checked);
  const allRules = rules.every(Boolean);
  const today = new Date().toISOString().split('T')[0];

  const type = count === 0 ? 'rules' : pnl >= 0 ? 'win' : 'loss';
  paperData.days[today] = { pnl, count, notes, rules, type };
  dbSet('td_paper', paperData);
  renderPaperCalendar();

  document.getElementById('paper-pnl').value = '';
  document.getElementById('paper-trades-count').value = '';
  document.getElementById('paper-notes').value = '';
  ['rule1','rule2','rule3','rule4','rule5'].forEach(id => document.getElementById(id).checked = false);
}

function renderPaperCalendar() {
  const cal = document.getElementById('paper-calendar');
  if (!paperData) {
    cal.innerHTML = '<div style="font-size:13px;color:var(--muted)">Start your 90-day challenge to begin tracking.</div>';
    updateSidebarProgress();
    return;
  }

  const start = new Date(paperData.startDate);
  const today = new Date();
  const totalDaysPassed = Math.floor((today - start) / 86400000) + 1;
  const challengeDay = Math.min(totalDaysPassed, 90);

  // Update header stats
  document.getElementById('paper-day-num').textContent = `Day ${challengeDay} / 90`;

  const allPnl = Object.values(paperData.days).reduce((s,d) => s + (d.pnl||0), 0);
  const pnlEl = document.getElementById('paper-total-pnl');
  pnlEl.textContent = `${allPnl>=0?'+':''}$${allPnl.toFixed(2)}`;
  pnlEl.style.color = allPnl >= 0 ? 'var(--accent2)' : 'var(--warn)';

  // Streak
  let streak = 0;
  for (let i = 0; i < challengeDay; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i);
    const key = d.toISOString().split('T')[0];
    const dayData = paperData.days[key];
    if (dayData && dayData.rules && dayData.rules.every(Boolean)) streak++;
    else streak = 0;
  }
  document.getElementById('paper-streak').textContent = streak;

  // Calendar dots
  cal.innerHTML = '<div class="paper-day-grid">' + Array.from({length:90}, (_,i) => {
    const d = new Date(start); d.setDate(d.getDate() + i);
    const key = d.toISOString().split('T')[0];
    const isPast = d <= today;
    const isToday = key === today.toISOString().split('T')[0];
    const dayData = paperData.days[key];
    let cls = 'day-dot ';
    if (!isPast) cls += 'future';
    else if (dayData) cls += dayData.type;
    else cls += 'empty';
    if (isToday) cls += ' today';
    const label = dayData ? (dayData.pnl >= 0 ? `+$${dayData.pnl.toFixed(0)}` : `-$${Math.abs(dayData.pnl).toFixed(0)}`) : (i+1);
    return `<div class="${cls}" title="Day ${i+1}: ${key}">${isPast ? label : ''}</div>`;
  }).join('') + '</div>';

  updateSidebarProgress();
  document.getElementById('paper-start-btn').textContent = '✓ Challenge Running';
}

function updateSidebarProgress() {
  const el = document.getElementById('sidebar-paper-progress');
  if (!paperData) { el.textContent = 'Not started'; el.style.color = 'var(--muted)'; return; }
  const start = new Date(paperData.startDate);
  const day = Math.min(Math.floor((new Date() - start) / 86400000) + 1, 90);
  const logged = Object.keys(paperData.days).length;
  el.innerHTML = `Day <strong style="color:var(--accent)">${day}</strong> / 90 &nbsp;·&nbsp; ${logged} days logged`;
}

// Set today's date in paper form
document.getElementById('paper-date').value = new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});

renderPaperCalendar();

// ==================== RSI SIMULATOR ====================
(function() {
  const ICAP = 10000, NPTS = 320;
  const CM = { top:8, right:12, bottom:22, left:58 };

  // RNG
  let _s = Date.now();
  function lcg() { _s = Math.imul(1664525,_s)+1013904223|0; return (_s>>>0)/4294967296; }
  function rnd() { let u,v; do{u=lcg();}while(!u); do{v=lcg();}while(!v); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }

  // Price generation (GBM + vol clustering)
  function genPrices(n) {
    const p=[100]; const drift=(lcg()-.5)*.0006; let vol=.015;
    for(let i=1;i<n;i++){
      vol=.007+.008*Math.abs(rnd())*.25+vol*.75;
      vol=Math.min(.045,Math.max(.004,vol));
      p.push(p[i-1]*Math.exp(drift-.5*vol*vol+vol*rnd()));
    }
    return p;
  }

  // RSI (Wilder smoothing)
  function calcRSI(px, period) {
    const r=new Array(px.length).fill(null);
    let ag=0,al=0;
    for(let i=1;i<=period&&i<px.length;i++){const d=px[i]-px[i-1];ag+=d>0?d:0;al+=d<0?-d:0;}
    ag/=period; al/=period;
    for(let i=period;i<px.length;i++){
      if(i>period){const d=px[i]-px[i-1];ag=(ag*(period-1)+(d>0?d:0))/period;al=(al*(period-1)+(d<0?-d:0))/period;}
      r[i]=al===0?100:100-100/(1+ag/al);
    }
    return r;
  }

  // Trade simulation
  function simulate(px,rsi,os,ob) {
    const trades=[],eq=[];
    let cash=ICAP,shares=0,entry=null;
    for(let i=0;i<px.length;i++){
      eq.push(cash+shares*px[i]);
      if(rsi[i]===null)continue;
      if(shares===0&&rsi[i]<=os){shares=cash/px[i];entry={i,p:px[i]};cash=0;}
      else if(shares>0&&rsi[i]>=ob){cash=shares*px[i];trades.push({ei:entry.i,xi:i,ep:entry.p,xp:px[i],pct:(px[i]/entry.p-1)*100,open:false});shares=0;entry=null;}
    }
    if(entry){const lp=px[px.length-1];trades.push({ei:entry.i,xi:px.length-1,ep:entry.p,xp:lp,pct:(lp/entry.p-1)*100,open:true});}
    return{trades,eq};
  }

  // Canvas helpers
  function ic(cv,w,h){const dpr=Math.min(window.devicePixelRatio||1,2);cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);cv.style.width=w+'px';cv.style.height=h+'px';const c=cv.getContext('2d');c.scale(dpr,dpr);return c;}
  function xp(i,n,pw){return CM.left+(i/(n-1))*pw;}
  function yp(v,lo,hi,ph){return CM.top+(1-(v-lo)/(hi-lo))*ph;}

  // Draw price chart
  function drawPrice(cv,px,trades){
    const W=parseInt(cv.style.width),H=parseInt(cv.style.height);
    const ctx=ic(cv,W,H),pw=W-CM.left-CM.right,ph=H-CM.top-CM.bottom,n=px.length;
    const lo=Math.min(...px),hi=Math.max(...px),pad=(hi-lo)*.06;
    const vn=lo-pad,vx=hi+pad;
    const x=i=>xp(i,n,pw),y=v=>yp(v,vn,vx,ph);
    ctx.fillStyle='#0d1117';ctx.fillRect(0,0,W,H);
    ctx.font='10px monospace';ctx.textAlign='right';ctx.strokeStyle='#21262d';ctx.lineWidth=1;
    for(let g=0;g<=4;g++){const gy=CM.top+g/4*ph;ctx.beginPath();ctx.moveTo(CM.left,gy);ctx.lineTo(W-CM.right,gy);ctx.stroke();ctx.fillStyle='#8b949e';ctx.fillText((vx-g/4*(vx-vn)).toFixed(2),CM.left-4,gy+3.5);}
    for(const t of trades){ctx.fillStyle=t.pct>=0?'rgba(63,185,80,.07)':'rgba(248,81,73,.07)';ctx.fillRect(x(t.ei),CM.top,x(t.xi)-x(t.ei),ph);}
    ctx.beginPath();ctx.strokeStyle='#58a6ff';ctx.lineWidth=1.5;ctx.lineJoin='round';
    for(let i=0;i<n;i++)i===0?ctx.moveTo(x(i),y(px[i])):ctx.lineTo(x(i),y(px[i]));
    ctx.stroke();
    for(const t of trades){
      ctx.fillStyle='#3fb950';ctx.beginPath();ctx.moveTo(x(t.ei),y(t.ep)-8);ctx.lineTo(x(t.ei)-5,y(t.ep)+3);ctx.lineTo(x(t.ei)+5,y(t.ep)+3);ctx.closePath();ctx.fill();
      if(!t.open){ctx.fillStyle='#f85149';ctx.beginPath();ctx.moveTo(x(t.xi),y(t.xp)+8);ctx.lineTo(x(t.xi)-5,y(t.xp)-3);ctx.lineTo(x(t.xi)+5,y(t.xp)-3);ctx.closePath();ctx.fill();}
    }
    ctx.fillStyle='#8b949e';ctx.font='bold 10px monospace';ctx.textAlign='left';
    ctx.fillText('PRICE',CM.left+4,CM.top+12);ctx.fillStyle='#3fb950';ctx.fillText('  ▲ BUY',CM.left+42,CM.top+12);ctx.fillStyle='#f85149';ctx.fillText('  ▼ SELL',CM.left+96,CM.top+12);
    ctx.strokeStyle='#30363d';ctx.lineWidth=1;ctx.strokeRect(CM.left,CM.top,pw,ph);
  }

  // Draw RSI indicator
  function drawRSI(cv,rsi,os,ob,period){
    const W=parseInt(cv.style.width),H=parseInt(cv.style.height);
    const ctx=ic(cv,W,H),pw=W-CM.left-CM.right,ph=H-CM.top-CM.bottom,n=rsi.length;
    const x=i=>xp(i,n,pw),y=v=>CM.top+(1-v/100)*ph;
    ctx.fillStyle='#0d1117';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(248,81,73,.07)';ctx.fillRect(CM.left,CM.top,pw,y(ob)-CM.top);
    ctx.fillStyle='rgba(63,185,80,.07)';ctx.fillRect(CM.left,y(os),pw,CM.top+ph-y(os));
    const lines=[{v:ob,c:'rgba(248,81,73,.6)',d:[4,3]},{v:50,c:'#21262d',d:[]},{v:os,c:'rgba(63,185,80,.6)',d:[4,3]}];
    ctx.font='10px monospace';ctx.textAlign='right';
    for(const{v,c,d}of lines){const gy=y(v);ctx.strokeStyle=c;ctx.lineWidth=d.length?1.5:1;ctx.setLineDash(d);ctx.beginPath();ctx.moveTo(CM.left,gy);ctx.lineTo(W-CM.right,gy);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#8b949e';ctx.fillText(v,CM.left-4,gy+3.5);}
    ctx.fillStyle='#8b949e';ctx.fillText('100',CM.left-4,CM.top+4);ctx.fillText('0',CM.left-4,CM.top+ph+3.5);
    ctx.beginPath();ctx.strokeStyle='#d2a8ff';ctx.lineWidth=1.5;ctx.lineJoin='round';
    let started=false;
    for(let i=0;i<n;i++){if(rsi[i]===null)continue;!started?(ctx.moveTo(x(i),y(rsi[i])),started=true):ctx.lineTo(x(i),y(rsi[i]));}
    ctx.stroke();
    ctx.fillStyle='#8b949e';ctx.font='bold 10px monospace';ctx.textAlign='left';ctx.fillText('RSI('+period+')',CM.left+4,CM.top+12);
    ctx.strokeStyle='#30363d';ctx.lineWidth=1;ctx.strokeRect(CM.left,CM.top,pw,ph);
  }

  // Draw equity curve
  function drawEquity(cv,eq,px){
    const W=parseInt(cv.style.width),H=parseInt(cv.style.height);
    const ctx=ic(cv,W,H),pw=W-CM.left-CM.right,ph=H-CM.top-CM.bottom,n=eq.length;
    const bh=px.map(p=>ICAP*p/px[0]);
    const allV=[...eq,...bh];const lo=Math.min(...allV),hi=Math.max(...allV);
    const pad=Math.max((hi-lo)*.08,200);const vn=lo-pad,vx=hi+pad;
    const x=i=>xp(i,n,pw),y=v=>yp(v,vn,vx,ph);
    ctx.fillStyle='#0d1117';ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#21262d';ctx.lineWidth=1;ctx.font='10px monospace';ctx.textAlign='right';
    for(let g=0;g<=3;g++){const gy=CM.top+g/3*ph;ctx.beginPath();ctx.moveTo(CM.left,gy);ctx.lineTo(W-CM.right,gy);ctx.stroke();const gv=vx-g/3*(vx-vn);ctx.fillStyle='#8b949e';ctx.fillText('$'+(gv>=1000?(gv/1000).toFixed(1)+'k':Math.round(gv)),CM.left-4,gy+3.5);}
    const baseY=y(ICAP);ctx.setLineDash([3,3]);ctx.strokeStyle='#30363d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(CM.left,baseY);ctx.lineTo(W-CM.right,baseY);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.strokeStyle='#484f58';ctx.lineWidth=1;for(let i=0;i<n;i++)i===0?ctx.moveTo(x(i),y(bh[i])):ctx.lineTo(x(i),y(bh[i]));ctx.stroke();
    const lastEq=eq[n-1],lineC=lastEq>=ICAP?'#3fb950':'#f85149',fillC=lastEq>=ICAP?'rgba(63,185,80,.1)':'rgba(248,81,73,.1)';
    ctx.beginPath();ctx.moveTo(x(0),y(eq[0]));for(let i=1;i<n;i++)ctx.lineTo(x(i),y(eq[i]));ctx.lineTo(x(n-1),CM.top+ph);ctx.lineTo(x(0),CM.top+ph);ctx.closePath();ctx.fillStyle=fillC;ctx.fill();
    ctx.beginPath();ctx.strokeStyle=lineC;ctx.lineWidth=2;ctx.lineJoin='round';for(let i=0;i<n;i++)i===0?ctx.moveTo(x(i),y(eq[i])):ctx.lineTo(x(i),y(eq[i]));ctx.stroke();
    ctx.fillStyle='#8b949e';ctx.font='bold 10px monospace';ctx.textAlign='left';ctx.fillText('EQUITY',CM.left+4,CM.top+12);ctx.fillStyle='#484f58';ctx.fillText('  B&H',CM.left+54,CM.top+12);
    ctx.strokeStyle='#30363d';ctx.lineWidth=1;ctx.strokeRect(CM.left,CM.top,pw,ph);
  }

  // Stats bar
  function updateStats(trades,eq,px){
    const fin=eq[eq.length-1],totR=(fin/ICAP-1)*100,bhR=(px[px.length-1]/px[0]-1)*100,alpha=totR-bhR;
    const closed=trades.filter(t=>!t.open),wins=closed.filter(t=>t.pct>0).length,wr=closed.length?wins/closed.length*100:0;
    let peak=ICAP,dd=0;for(const e of eq){if(e>peak)peak=e;dd=Math.max(dd,(peak-e)/peak*100);}
    const S=[
      {l:'Strategy',v:(totR>=0?'+':'')+totR.toFixed(2)+'%',c:totR>=0?'rsi-pos':'rsi-neg'},
      {l:'Buy & Hold',v:(bhR>=0?'+':'')+bhR.toFixed(2)+'%',c:bhR>=0?'rsi-pos':'rsi-neg'},
      {l:'Alpha',v:(alpha>=0?'+':'')+alpha.toFixed(2)+'%',c:alpha>=0?'rsi-pos':'rsi-neg'},
      {l:'Final Value',v:'$'+Math.round(fin).toLocaleString(),c:fin>=ICAP?'rsi-pos':'rsi-neg'},
      {l:'Trades',v:closed.length,c:'rsi-neu'},
      {l:'Win Rate',v:closed.length?wr.toFixed(0)+'%':'—',c:wr>=50?'rsi-pos':'rsi-neg'},
      {l:'Max Drawdown',v:dd.toFixed(1)+'%',c:dd>15?'rsi-neg':'rsi-neu'},
    ];
    document.getElementById('statsBar').innerHTML=S.map(s=>`<div class="rsi-stat"><span class="rsi-stat-label">${s.l}</span><span class="rsi-stat-value ${s.c}">${s.v}</span></div>`).join('');
  }

  // Redraw
  const pcv=document.getElementById('priceCanvas'),rcv=document.getElementById('rsiCanvas'),ecv=document.getElementById('equityCanvas'),cont=document.getElementById('chartsContainer');
  let rsiPrices=[];

  function getParams(){return{period:+document.getElementById('rsiPeriod').value,os:+document.getElementById('oversold').value,ob:+document.getElementById('overbought').value};}

  function redraw(){
    const{period,os,ob}=getParams(),rsi=calcRSI(rsiPrices,period);
    const{trades,eq}=simulate(rsiPrices,rsi,os,ob);
    const W=cont.clientWidth,H=cont.clientHeight;
    if(!W||!H)return;
    const pH=Math.floor(H*.47),rH=Math.floor(H*.30),eH=H-pH-rH;
    pcv.style.width=W+'px';pcv.style.height=pH+'px';
    rcv.style.width=W+'px';rcv.style.height=rH+'px';
    ecv.style.width=W+'px';ecv.style.height=eH+'px';
    drawPrice(pcv,rsiPrices,trades);
    drawRSI(rcv,rsi,os,ob,period);
    drawEquity(ecv,eq,rsiPrices);
    updateStats(trades,eq,rsiPrices);
  }

  function newData(){_s=Date.now();rsiPrices=genPrices(NPTS);redraw();}

  ['rsiPeriod','oversold','overbought'].forEach(id=>{
    document.getElementById(id).addEventListener('input',()=>{document.getElementById(id+'Val').textContent=document.getElementById(id).value;redraw();});
  });
  document.getElementById('rsi-regen').addEventListener('click',newData);

  // Lazy init — wait until tab is first clicked so canvases have dimensions
  let rsiReady=false;
  document.querySelector('[data-tab="rsi"]').addEventListener('click',()=>{
    if(!rsiReady){rsiReady=true;setTimeout(newData,50);}
    else setTimeout(redraw,50);
  });
  window.addEventListener('resize',()=>{if(rsiReady)redraw();});
})();

// ==================== CLASSROOM ====================
const YT_PLAYLISTS = {
  pl1: { id: 'PLmaCbAD6I1AyI7jO4SiM38hgc2pWgFOG_', name: 'Day Trading Foundations',    meta: 'Beginner · Core concepts' },
  pl2: { id: 'PLhtFvg1mD43-74PAYx-bQdcpiKktlNrFG', name: 'Trading Strategy Deep Dive', meta: 'Intermediate · Advanced setups' },
};
let clsCurrentPl = 'pl1';
let clsVideos = { pl1: null, pl2: null }; // null = not loaded yet

// ---- YouTube API key ----
function saveYtKey() {
  const key = document.getElementById('yt-api-key-inp').value.trim();
  if (!key) return;
  dbSet('td_yt_key', key);
  loadPlaylistVideos(clsCurrentPl);
}

function getYtKey() {
  return localStorage.getItem('td_yt_key') || '';
}

// ---- Playlist selector ----
function selectPlaylist(pl) {
  clsCurrentPl = pl;
  document.querySelectorAll('.cls-pl-card').forEach(c => c.classList.remove('active'));
  document.querySelector(`.cls-pl-card[data-pl="${pl}"]`).classList.add('active');
  document.getElementById('cls-vlist-title').textContent = YT_PLAYLISTS[pl].name;
  if (clsVideos[pl]) {
    renderVideoList(pl, clsVideos[pl]);
  } else if (getYtKey()) {
    loadPlaylistVideos(pl);
  } else {
    document.getElementById('cls-vlist-scroll').innerHTML =
      `<div class="cls-vlist-nokey">Enter your free YouTube API key above to browse this playlist.</div>`;
    document.getElementById('cls-vlist-count').textContent = '';
  }
}

// ---- Fetch playlist videos from YouTube Data API v3 ----
async function loadPlaylistVideos(pl) {
  const key = getYtKey();
  if (!key) return;
  const plId = YT_PLAYLISTS[pl].id;
  const scroll = document.getElementById('cls-vlist-scroll');
  scroll.innerHTML = '<div class="cls-vlist-loading">Loading videos…</div>';
  document.getElementById('cls-vlist-count').textContent = '';
  try {
    // Also fetch the actual playlist name
    const plRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${plId}&key=${key}`
    );
    if (plRes.ok) {
      const plData = await plRes.json();
      if (plData.items && plData.items[0]) {
        const actualName = plData.items[0].snippet.title;
        document.getElementById(`cls-${pl}-name`).textContent = actualName;
        YT_PLAYLISTS[pl].name = actualName;
      }
    }

    // Fetch up to 50 videos (one page)
    let videos = [];
    let pageToken = '';
    do {
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${plId}&key=${key}${pageToken ? '&pageToken='+pageToken : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'API error');
      }
      const data = await res.json();
      videos = videos.concat(data.items || []);
      pageToken = data.nextPageToken || '';
    } while (pageToken && videos.length < 200);

    // Filter out deleted/private videos
    videos = videos.filter(v => v.snippet.title !== 'Deleted video' && v.snippet.title !== 'Private video');
    clsVideos[pl] = videos;
    document.getElementById(`cls-${pl}-meta`).textContent = `${videos.length} videos`;
    renderVideoList(pl, videos);
  } catch(e) {
    scroll.innerHTML = `<div class="cls-vlist-nokey" style="color:var(--warn)">
      ⚠ Could not load videos.<br><br>
      <strong>Error:</strong> ${e.message}<br><br>
      Check your API key and make sure <em>YouTube Data API v3</em> is enabled in Google Cloud Console.
    </div>`;
    document.getElementById('cls-vlist-count').textContent = '';
  }
}

// ---- Render video list ----
function renderVideoList(pl, videos) {
  const scroll = document.getElementById('cls-vlist-scroll');
  document.getElementById('cls-vlist-count').textContent = videos.length;
  if (!videos.length) {
    scroll.innerHTML = '<div class="cls-vlist-nokey">No videos found in this playlist.</div>';
    return;
  }
  // Use data attributes to avoid any quote-escaping issues in onclick
  scroll.innerHTML = videos.map((v, i) => {
    const s = v.snippet;
    const videoId = s.resourceId.videoId;
    const thumb = s.thumbnails?.default?.url || '';
    const title = s.title;
    return `<div class="cls-video-item" id="vitem-${videoId}" data-vid="${videoId}" data-title="${title.replace(/"/g,'&quot;').replace(/'/g,'&#39;')}">
      <img class="cls-video-thumb" src="${thumb}" alt="" loading="lazy">
      <div class="cls-video-info">
        <div class="cls-video-title">${title}</div>
        <div class="cls-video-num">#${i+1}</div>
      </div>
    </div>`;
  }).join('');

  // Attach click handlers via event delegation — no inline JS needed
  scroll.querySelectorAll('.cls-video-item').forEach(el => {
    el.addEventListener('click', () => playVideo(el.dataset.vid, el.dataset.title));
  });
}

// ---- YouTube IFrame Player API ----
let _ytPlayer = null;
let _ytApiReady = false;
let _pendingPlay = null; // { videoId, title } queued before API loaded

window.onYouTubeIframeAPIReady = function() {
  _ytApiReady = true;
  if (_pendingPlay) {
    _doPlay(_pendingPlay.videoId, _pendingPlay.title);
    _pendingPlay = null;
  }
};

function _doPlay(videoId, title) {
  document.getElementById('cls-pick-prompt').style.display = 'none';
  document.getElementById('cls-embed-error').style.display = 'none';

  // Destroy old player and recreate — avoids stale error state
  if (_ytPlayer) { try { _ytPlayer.destroy(); } catch(e){} _ytPlayer = null; }

  // Recreate the target div (destroy() removes it)
  const wrap = document.getElementById('cls-player-wrap');
  let playerDiv = document.getElementById('cls-yt-player');
  if (!playerDiv) {
    playerDiv = document.createElement('div');
    playerDiv.id = 'cls-yt-player';
    playerDiv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    wrap.appendChild(playerDiv);
  }

  _ytPlayer = new YT.Player('cls-yt-player', {
    videoId: videoId,
    playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
    events: {
      onReady: function(e) { e.target.playVideo(); },
      onError: function(e) {
        // 100 = not found, 101/150 = embed not allowed, 153 = same (older code)
        if (e.data === 100 || e.data === 101 || e.data === 150 || e.data === 153) {
          showEmbedError(videoId, title);
        }
      }
    }
  });
}

function showEmbedError(videoId, title) {
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  document.getElementById('cls-embed-error').style.display = 'flex';
  document.getElementById('cls-err-title').textContent = title;
  document.getElementById('cls-err-yt-link').href = ytUrl;
  document.getElementById('cls-err-popup-btn').onclick =
    () => window.open(ytUrl, '_blank', 'width=900,height=560,resizable=yes');
}

// ---- Play a video ----
function playVideo(videoId, title) {
  // Highlight selected item in list
  document.querySelectorAll('.cls-video-item').forEach(el => el.classList.remove('playing'));
  const item = document.getElementById('vitem-' + videoId);
  if (item) { item.classList.add('playing'); item.scrollIntoView({ block:'nearest' }); }

  // Now-playing bar
  document.getElementById('cls-now-playing').style.display = '';
  document.getElementById('cls-now-title').textContent = title;

  if (_ytApiReady) {
    _doPlay(videoId, title);
  } else {
    // API still loading — queue it
    _pendingPlay = { videoId, title };
  }
}

// ---- Checklist accordion ----
function toggleChecklist() {
  const inner = document.getElementById('cls-checklist-inner');
  const arrow = document.getElementById('cls-chk-arrow');
  inner.classList.toggle('open');
  arrow.textContent = inner.classList.contains('open') ? '▾' : '▸';
}

// ---- Notes ----
let clsNotes = JSON.parse(localStorage.getItem('td_cls_notes') || '[]');
const tagMeta = {
  pl1:     { label: 'Playlist 1', bg: 'rgba(88,166,255,.15)', color: 'var(--accent)' },
  pl2:     { label: 'Playlist 2', bg: 'rgba(63,185,80,.15)',  color: 'var(--accent2)' },
  general: { label: 'General',    bg: 'rgba(227,179,65,.15)', color: 'var(--gold)' },
  strategy:{ label: 'Strategy',   bg: 'rgba(88,166,255,.12)', color: 'var(--accent)' },
  risk:    { label: 'Risk Mgmt',  bg: 'rgba(248,81,73,.15)',  color: 'var(--warn)' },
  mindset: { label: 'Mindset',    bg: 'rgba(227,179,65,.12)', color: 'var(--gold)' },
};

function addClassroomNote() {
  const text = document.getElementById('cls-note-input').value.trim();
  const tag  = document.getElementById('cls-note-tag').value;
  if (!text) return;
  const now = new Date().toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  clsNotes.unshift({ text, tag, date: now });
  dbSet('td_cls_notes', clsNotes);
  document.getElementById('cls-note-input').value = '';
  renderClsNotes();
}

function deleteClsNote(i) {
  clsNotes.splice(i, 1);
  dbSet('td_cls_notes', clsNotes);
  renderClsNotes();
}

function renderClsNotes() {
  const list = document.getElementById('cls-note-list');
  document.getElementById('cls-note-count').textContent = clsNotes.length;
  if (!clsNotes.length) {
    list.innerHTML = '<div style="padding:14px;text-align:center;font-size:12px;color:var(--muted)">No notes yet. Write key takeaways as you watch.</div>';
    return;
  }
  list.innerHTML = clsNotes.map((n,i) => {
    const t = tagMeta[n.tag] || tagMeta.general;
    return `<div class="cls-note-card">
      <div class="note-content">
        <span class="note-tag" style="background:${t.bg};color:${t.color}">${t.label}</span>
        <div class="note-text" style="margin-top:5px">${n.text}</div>
        <div class="note-meta">${n.date}</div>
      </div>
      <button class="del-btn" onclick="deleteClsNote(${i})" title="Delete">×</button>
    </div>`;
  }).join('');
}

// ---- Init classroom ----
(function initClassroom() {
  const savedKey = getYtKey();
  if (savedKey) document.getElementById('yt-api-key-inp').value = savedKey;
  // Set default playlist name/meta
  Object.entries(YT_PLAYLISTS).forEach(([pl, info]) => {
    document.getElementById(`cls-${pl}-meta`).textContent = info.meta;
  });
  document.getElementById('cls-vlist-title').textContent = YT_PLAYLISTS['pl1'].name;
  if (savedKey) loadPlaylistVideos('pl1');
})();

// Study checklist persistence
function saveChecks() {
  const checks = {};
  for (let i = 1; i <= 12; i++) {
    checks['chk'+i] = document.getElementById('chk'+i).checked;
  }
  dbSet('td_cls_checks', checks);
  updateCheckProgress();
}

function loadChecks() {
  const saved = JSON.parse(localStorage.getItem('td_cls_checks') || '{}');
  for (let i = 1; i <= 12; i++) {
    const el = document.getElementById('chk'+i);
    if (el && saved['chk'+i]) el.checked = true;
  }
  updateCheckProgress();
}

function updateCheckProgress() {
  let count = 0;
  for (let i = 1; i <= 12; i++) {
    if (document.getElementById('chk'+i)?.checked) count++;
  }
  document.getElementById('check-progress').textContent = `${count} / 12`;
}

// Enter key for note input
document.getElementById('cls-note-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addClassroomNote();
});

renderClsNotes();
loadChecks();

// ==================== QUIZ ENGINE ====================

// ---- Question Bank (50+ questions, 8 categories) ----
const QUIZ_BANK = [
  // TERMS
  { id:1, cat:'terms', q:'What does VWAP stand for?', opts:['Volume Weighted Average Price','Volatile Weighted Asset Price','Value Weighted Average Position','Volume Weighted Asset Position'], ans:0, exp:'VWAP (Volume Weighted Average Price) is the average price a stock traded at throughout the day, weighted by volume. Traders use it as a benchmark — price above VWAP is bullish, below is bearish. It resets every day at open.' },
  { id:2, cat:'terms', q:'What is a stock\'s "float"?', opts:['Total shares ever issued','Shares available for public trading','Number of short positions','Daily trading volume'], ans:1, exp:'Float is the number of shares available for public trading. A low-float stock (under 10–20 million shares) can move much more violently on news because supply is limited. High float stocks need huge volume to make big moves.' },
  { id:3, cat:'terms', q:'What is the PDT (Pattern Day Trader) rule?', opts:['You must profit on 4 out of 5 trades','If you make 4+ day trades in 5 business days with under $25,000, your account is flagged','You can only trade 3 times per week','Accounts over $25,000 pay higher commission'], ans:1, exp:'The PDT rule (FINRA Rule 4210) requires a minimum equity of $25,000 to execute 4 or more day trades within 5 business days in a margin account. Violating it restricts your account for 90 days. Workaround: use a cash account or trade with a broker outside the US.' },
  { id:4, cat:'terms', q:'What is the "bid-ask spread"?', opts:['Difference between open and close price','Difference between highest buyer price and lowest seller price','The daily trading range','The difference between pre-market and regular session price'], ans:1, exp:'The bid is the highest price a buyer will pay. The ask is the lowest price a seller will accept. The spread is the gap between them. Wider spreads mean more risk and cost — especially on low-liquidity stocks. Always check the spread before entering a trade.' },
  { id:5, cat:'terms', q:'What is a "catalyst" in day trading?', opts:['A technical indicator','News or event that causes a stock to make a significant move','A type of order','A measurement of volatility'], ans:1, exp:'A catalyst is something that triggers a significant price move — earnings reports, FDA approvals, contract wins, short squeezes, upgrades/downgrades, and macroeconomic data. The best day trades usually have a clear catalyst driving the move.' },
  { id:6, cat:'terms', q:'What does "going short" mean?', opts:['Holding a position for less than 1 hour','Borrowing shares to sell them now, hoping to buy back cheaper later','Buying a stock with high short interest','Selling at a loss'], ans:1, exp:'Short selling is borrowing shares from your broker, selling them at the current price, and hoping to buy them back later at a lower price (covering). If the stock goes up instead, your loss is theoretically unlimited — this is why risk management is critical for short sellers.' },
  { id:7, cat:'terms', q:'What is "Level 2" in trading?', opts:['A trading certification level','Real-time display of all buy and sell orders at different price levels','The second candlestick on a chart','A margin account feature'], ans:1, exp:'Level 2 (also called the order book or market depth) shows the actual buy orders (bids) and sell orders (asks) stacked at different price levels. It helps you see where supply and demand walls are, spot potential breakout or rejection levels, and understand the balance of buyers vs. sellers.' },
  { id:8, cat:'terms', q:'What is a "gap up"?', opts:['A stock rising steadily all day','When a stock opens significantly higher than the previous day\'s close','A gap in your trading records','When volume is unusually low'], ans:1, exp:'A gap up occurs when a stock opens above the prior day\'s closing price, creating a price "gap" on the chart. This often happens due to overnight news, earnings, or pre-market buying pressure. Gaps can be traded as "gap and go" (continuation) or "gap fade" (reversal).' },
  { id:9, cat:'terms', q:'What does "tape reading" mean?', opts:['Recording your trades on paper','Reading candlestick charts','Watching the Time & Sales to gauge real-time order flow and momentum','Using a ruler to measure chart patterns'], ans:2, exp:'Tape reading is analyzing the Time & Sales feed (the "tape") — the stream of actual executed trades — to understand momentum and conviction. Large blocks printing on the bid signal selling pressure; large prints on the ask signal buying. It\'s a skill that takes time to develop.' },
  { id:10, cat:'terms', q:'What is "short interest"?', opts:['The interest rate on a short loan','The percentage of a company\'s float that is currently sold short','How quickly a stock falls','The time limit on a short position'], ans:1, exp:'Short interest is the percentage of a stock\'s float that is currently held short. High short interest (above 20-30%) means many traders are betting the stock will fall — but it also sets the stage for a short squeeze if the stock starts rising and shorts are forced to cover.' },

  // CHART PATTERNS
  { id:11, cat:'patterns', q:'What is a "bull flag" pattern?', opts:['A V-shaped reversal','A tight, orderly pullback after a sharp move up, then continuation higher','A triple-top formation','A pattern that only occurs in bull markets'], ans:1, exp:'A bull flag is a continuation pattern. The "flagpole" is the sharp initial move up (on high volume). The "flag" is the tight, downward-sloping consolidation (usually on lower volume). When price breaks above the upper flag channel with volume, it signals continuation. Target = flagpole height added to breakout point.' },
  { id:12, cat:'patterns', q:'What is an Opening Range Breakout (ORB)?', opts:['Trading when the market opens','The first gap up of the day','Trading a breakout above or below the high/low of the first 5-30 minutes','A pattern that only works at market open'], ans:2, exp:'ORB involves identifying the high and low of the opening range (typically first 5, 15, or 30 minutes), then trading a breakout above the high (long) or below the low (short). It\'s one of the most popular strategies for beginner day traders because it gives clear entry and stop levels.' },
  { id:13, cat:'patterns', q:'What is "support" in technical analysis?', opts:['A government program for struggling companies','A price level where a stock has historically found buying interest (bounced)','The highest price a stock has reached','When a stock is trending upward'], ans:1, exp:'Support is a price level where demand has historically been strong enough to stop the stock from falling further. Think of it as a floor. The more times price has bounced at that level, the stronger the support. When support breaks, it often flips to resistance.' },
  { id:14, cat:'patterns', q:'What does high volume on a breakout tell you?', opts:['The stock is overvalued','The breakout is more likely to be real and sustained','The stock will reverse immediately','Nothing — volume doesn\'t matter'], ans:1, exp:'Volume is the most important confirmation tool. A breakout on low volume is suspect — it may be a false breakout that reverses quickly. A breakout on 2x-3x+ normal volume signals real conviction from big buyers. Never trade a breakout without checking volume.' },
  { id:15, cat:'patterns', q:'What is a "doji" candlestick?', opts:['A candle with no volume','A candle where open and close are nearly equal, forming a cross shape','A large bullish candle','A pattern indicating a guaranteed reversal'], ans:1, exp:'A doji forms when the open and close are nearly the same price, creating a cross or plus sign shape. It signals indecision between buyers and sellers. After a sustained trend, a doji can warn of a potential reversal — but always look for confirmation from the next candle.' },
  { id:16, cat:'patterns', q:'What is a "bear flag"?', opts:['A pattern in a bear market only','A tight, upward-sloping consolidation after a sharp move DOWN, then continuation lower','The opposite of a breakout','When a stock gaps down on earnings'], ans:1, exp:'A bear flag is the inverse of a bull flag. The "pole" is the sharp drop. The "flag" is the orderly bounce/consolidation (usually on low volume). When price breaks below the flag lower channel with volume, it signals continuation downward. Target = pole height subtracted from breakout.' },
  { id:17, cat:'patterns', q:'What does a "hammer" candlestick signal?', opts:['A stock hitting new lows','Potential bullish reversal — long lower wick shows buyers stepped in','Bearish continuation','Extremely high volatility'], ans:1, exp:'A hammer has a small body at the top and a long lower wick (at least 2x the body). It signals that sellers pushed the price down significantly during the candle, but buyers stepped in and pushed it back up — a sign of potential reversal. Stronger at known support levels.' },
  { id:18, cat:'patterns', q:'What is "resistance"?', opts:['A stock that refuses to move','A price level where selling pressure has historically been strong (ceiling)','A type of moving average','When a stock gaps down'], ans:1, exp:'Resistance is a price level acting as a ceiling — where supply (sellers) has historically overwhelmed demand (buyers), causing the stock to stall or reverse. Like support, the more times a level has been tested, the more significant it is. A break above resistance with volume is often a strong buy signal.' },

  // RISK MANAGEMENT
  { id:19, cat:'risk', q:'What is a "Risk:Reward ratio" (R:R)?', opts:['Your win rate percentage','The ratio of how much you risk vs. how much you stand to make','Your account size vs. daily limit','The ratio of winners to losers'], ans:1, exp:'R:R compares potential loss to potential gain. A 1:2 R:R means you risk $100 to potentially make $200. Even with a 50% win rate, a 1:2 R:R is profitable. A 1:3 R:R means you only need to be right 33% of the time to break even. Always define your risk before entering.' },
  { id:20, cat:'risk', q:'What is the "1% rule" in position sizing?', opts:['Only trade stocks up 1% or more','Never risk more than 1-2% of your total account on a single trade','Always aim for 1% profit per trade','Keep 1% of profits as cash reserve'], ans:1, exp:'The 1% rule says never risk more than 1-2% of your total account on any single trade. With a $10,000 account, you\'d risk no more than $100-$200 per trade. This ensures no single loss is catastrophic and allows you to survive a losing streak of 10-20 trades without blowing up.' },
  { id:21, cat:'risk', q:'What is a "stop loss"?', opts:['The maximum profit target','A predetermined exit point to limit your loss if the trade goes against you','A type of order that stops you from overtrading','When a broker forces you out of a position'], ans:1, exp:'A stop loss is your emergency exit. Before entering a trade, you define the price where you\'ll exit if you\'re wrong. It must be placed at a level that invalidates your trade thesis — usually below a key support or above a key resistance. Never trade without a stop loss.' },
  { id:22, cat:'risk', q:'What is a "trailing stop"?', opts:['A stop loss that never changes','A stop that automatically moves in your favor as price moves in your favor','A stop that triggers after a time delay','A mental note to sell if the price drops'], ans:1, exp:'A trailing stop moves up (for long positions) as the price rises, locking in profits while still allowing the trade to run. If a stock goes from $10 to $15 with a $1 trailing stop, the stop moves from $9 to $14. It\'s a way to let winners run while protecting gains.' },
  { id:23, cat:'risk', q:'Why is having a "max daily loss limit" important?', opts:['It isn\'t — you should keep trying to recover','It prevents emotional revenge trading from turning a bad day into a catastrophic one','It helps you track income taxes','It\'s required by law'], ans:1, exp:'A max daily loss limit (e.g., lose 2-3% of account in a day → stop trading) is one of the most important rules for new traders. Bad trading days often spiral: you lose → get emotional → size up to recover → lose more. A hard stop prevents this feedback loop from destroying your account.' },
  { id:24, cat:'risk', q:'You have a 40% win rate and 1:2 R:R. Are you profitable (ignoring commissions)?', opts:['No — you need at least 50% win rate','Yes — 40% wins × 2R gain exceeds 60% losses × 1R loss','Break even','Not enough information'], ans:1, exp:'Math: 40 wins × $200 = $8,000. 60 losses × $100 = $6,000. Net = +$2,000. You can be profitable with a sub-50% win rate if your R:R is good. This is why R:R matters more than win rate for long-term profitability. Many professional traders win less than 50% of trades.' },
  { id:25, cat:'risk', q:'What is "position sizing"?', opts:['How long you hold a position','Calculating the correct number of shares to buy based on your stop distance and risk tolerance','The physical size of your trading monitor','How many positions you hold at once'], ans:1, exp:'Position sizing formula: Shares = ($ risk per trade) ÷ (entry price − stop price). If you risk $100 per trade, enter at $20, and stop at $19.50, you buy $100 ÷ $0.50 = 200 shares. This keeps your dollar risk consistent regardless of the stock\'s price.' },

  // ORDER TYPES
  { id:26, cat:'orders', q:'What is a "market order"?', opts:['An order to buy/sell at a specific price','An order to buy/sell immediately at the best available current price','An order that only executes at market open','An order for stocks listed on major exchanges only'], ans:1, exp:'A market order executes immediately at the best available price. It guarantees execution but NOT price — especially dangerous on low-volume stocks with wide spreads where you can get "slippage" (fill at a much worse price than expected). Use limit orders instead on volatile or illiquid stocks.' },
  { id:27, cat:'orders', q:'What is a "limit order"?', opts:['An order with a maximum holding time','An order to buy/sell ONLY at a specified price or better','An order that limits your profit','An order capped at $1,000'], ans:1, exp:'A limit order specifies the maximum price you\'re willing to pay (buy limit) or minimum price you\'ll accept (sell limit). It gives you price control but no guarantee of execution — the stock may never hit your limit price. Essential for volatile stocks to avoid bad fills.' },
  { id:28, cat:'orders', q:'What is a "stop-limit order"?', opts:['A stop loss and profit target in one order','Becomes a LIMIT order (not market order) when the trigger price is hit','An order that stops trading for the day','A market order with a price guarantee'], ans:1, exp:'A stop-limit has two prices: the stop (trigger) and the limit (execution max). When price hits the stop, it places a limit order. Unlike a stop-market, it won\'t fill at any price — if the stock gaps past your limit, you may not get filled at all. Can leave you unprotected in fast moves.' },
  { id:29, cat:'orders', q:'What causes "slippage" on a market order?', opts:['Your internet connection being slow','The difference between expected fill price and actual fill price due to market movement or low liquidity','The broker charging extra fees','Placing an order outside market hours'], ans:1, exp:'Slippage occurs when your order fills at a different (worse) price than you expected. On a liquid stock with a tight spread, slippage is minimal. On a low-float stock with a wide spread during a volatile move, slippage can be significant — costing you far more than planned. Always use limit orders on thin stocks.' },
  { id:30, cat:'orders', q:'What is a "MOO" order?', opts:['A confused investor','Market On Open — executes at the opening price','Market Overnight Order','A type of futures contract'], ans:1, exp:'MOO (Market On Open) is an order that executes at the very first trade of the regular session (9:30 AM ET). It\'s useful when you want to get in or out at the open price without battling pre-market spreads. Similar: MOC (Market On Close) executes at the 4 PM close.' },

  // MARKET MECHANICS
  { id:31, cat:'mechanics', q:'What are regular US stock market trading hours?', opts:['7:00 AM – 5:00 PM ET','9:30 AM – 4:00 PM ET','8:00 AM – 6:00 PM ET','9:00 AM – 4:30 PM ET'], ans:1, exp:'NYSE and NASDAQ regular trading hours are 9:30 AM to 4:00 PM Eastern Time, Monday through Friday (excluding US market holidays). Pre-market trading: 4:00–9:30 AM. After-hours: 4:00–8:00 PM. Volume and liquidity are significantly lower outside regular hours.' },
  { id:32, cat:'mechanics', q:'What is a "short squeeze"?', opts:['When shorts make massive profits','When short sellers are forced to buy back shares to cover, rapidly driving the price up','A technical pattern on a chart','When a stock is removed from short-able securities'], ans:1, exp:'A short squeeze happens when a heavily shorted stock rises sharply, forcing short sellers to buy shares to cover (limit their losses). This buying pressure drives the price even higher, triggering more shorts to cover — a feedback loop. High short interest + catalyst + momentum = potential squeeze. GameStop (GME) in 2021 is the most famous example.' },
  { id:33, cat:'mechanics', q:'What does high volume indicate about a price move?', opts:['The move is definitely going to reverse','The move has stronger conviction and is more likely to be sustained','The stock is being manipulated','Nothing — volume is irrelevant'], ans:1, exp:'Volume is the fuel behind price moves. High volume on a breakout = institutional or significant buying/selling — more likely to follow through. Low volume on a move = lack of conviction, more likely to reverse (false breakout). Always volume-confirm your technical signals.' },
  { id:34, cat:'mechanics', q:'What is a "circuit breaker" in the stock market?', opts:['A broker tool to prevent overtrading','An automatic trading halt triggered when major indexes fall a certain percentage in a day','A type of limit order','A device that cuts power to trading terminals'], ans:1, exp:'Market-wide circuit breakers (Rule 48) halt trading when the S&P 500 drops 7% (Level 1 — 15 min halt), 13% (Level 2 — 15 min halt), or 20% (Level 3 — rest of day halt). Individual stocks also have circuit breakers (LULD bands) that pause trading when they move too fast.' },
  { id:35, cat:'mechanics', q:'What time of day is generally most volatile for day traders?', opts:['12:00–2:00 PM (lunch hour)','9:30–10:30 AM (market open)','3:00–4:00 PM only','Pre-market only'], ans:1, exp:'The first 30-60 minutes after market open (9:30–10:30 AM ET) is the most volatile and highest-volume period. Stocks react to overnight news, gap moves are tested, and institutional orders execute. Most beginner-friendly strategies (ORB, gap plays) focus on this window. 10:00–11:30 AM can also offer cleaner setups.' },
  { id:36, cat:'mechanics', q:'What does "price discovery" mean at market open?', opts:['The broker finds the best price for you','The process of the market establishing a fair price after overnight news','A type of algorithmic trading','Reading pre-market charts'], ans:1, exp:'Price discovery is the chaotic first minutes after open where buyers and sellers are finding a "fair" price based on overnight developments. For a stock that gapped up 30% on news, the first 5-10 minutes can see wild swings as traders figure out where value is. Many experienced traders wait for price discovery to finish before entering.' },

  // PSYCHOLOGY
  { id:37, cat:'psychology', q:'What is "FOMO" and why is it dangerous in trading?', opts:['Fear Of Missing Out — leads to chasing extended moves and entering at the worst possible time','A type of chart pattern','A risk management technique','Fear Of Market Operations'], ans:0, exp:'FOMO is the fear of being left behind while a stock surges. It leads to chasing — entering a stock that\'s already moved 20-30% because you\'re afraid it\'ll keep going. You end up buying at the top, right before the reversal. The cure: define your entry criteria in advance and only take trades that meet them.' },
  { id:38, cat:'psychology', q:'What is "revenge trading"?', opts:['Trading a competitor\'s stock after a bad experience','Trading emotionally and recklessly after a loss to try to win back money','A legal strategy involving insider information','Trading the same stock twice in one day'], ans:1, exp:'Revenge trading is trying to "win back" losses by taking bigger, more reckless trades — usually right after a losing trade when emotions are highest. It almost always makes things worse. The cure: a strict max daily loss rule. Once hit, turn off the platform and stop. Protect your capital; the market will be there tomorrow.' },
  { id:39, cat:'psychology', q:'Why do traders keep a journal?', opts:['It\'s required by the SEC','To track patterns in their own behavior and improve their decision-making over time','To satisfy their broker\'s requirements','To share trades on social media'], ans:1, exp:'A trading journal is one of the most powerful improvement tools available. It forces you to review your decisions objectively: why did you enter? did you follow your rules? what emotion were you feeling? Over time, patterns emerge — you might find you always lose on Fridays, or after a big win, or on certain setups. Data beats ego.' },
  { id:40, cat:'psychology', q:'What is "overtrading"?', opts:['Trading stocks worth over $100','Taking too many low-quality trades, often out of boredom or impatience','Using too much margin','Trading too many different strategies at once'], ans:1, exp:'Overtrading means taking trades just to be "doing something" rather than waiting for genuinely high-quality setups. It leads to increased commission costs, more exposure to randomness, and emotional fatigue. Professional traders often say the hardest skill is knowing when NOT to trade. Quality over quantity, always.' },
  { id:41, cat:'psychology', q:'What is "confirmation bias" in trading?', opts:['Waiting for a second signal before entering','Only seeking information that confirms your existing trade idea while ignoring warning signs','A pattern that confirms a trend is real','Getting a second opinion on a trade'], ans:1, exp:'Confirmation bias is selectively absorbing information that agrees with your position and ignoring contradictory signals. If you\'re long a stock, you might dismiss bearish signals as "noise" while overweighting every bullish sign. It leads to holding losers too long. Force yourself to actively look for reasons your trade thesis is WRONG.' },
  { id:42, cat:'psychology', q:'You had a great morning and made your daily goal. Should you keep trading?', opts:['Yes — momentum is on your side','Usually no — statistically, most traders give back profits by continuing to trade after hitting their goal','Yes — always try to make more','It depends on the market conditions'], ans:1, exp:'Many traders find that their best risk-management move is stopping after hitting their daily profit target. After a big win, ego can take over — you feel invincible, loosen your rules, and give back the gains. Setting a daily target and stopping when you hit it is a professional habit that protects your wins.' },

  // TECHNICAL ANALYSIS
  { id:43, cat:'technical', q:'What does an RSI reading above 70 typically indicate?', opts:['The stock is about to go up 70%','The stock is overbought and may be due for a pullback','A strong buy signal','The stock has 70% short interest'], ans:1, exp:'RSI (Relative Strength Index) measures momentum on a 0-100 scale. Above 70 = overbought (stock has risen too fast, pullback possible). Below 30 = oversold (possible bounce). Important caveat: in strong trends, RSI can stay overbought for extended periods. Always combine RSI with other signals, not in isolation.' },
  { id:44, cat:'technical', q:'What is an EMA?', opts:['Emergency Market Alert','Exponential Moving Average — gives more weight to recent prices than older ones','Equal Market Access','Earnings Momentum Analyzer'], ans:1, exp:'An EMA (Exponential Moving Average) is a type of moving average that weights recent prices more heavily than older ones. Common EMAs used by day traders: 9 EMA (short-term momentum), 20 EMA (short-term trend), 50 EMA (medium-term trend). Price above the 9 EMA = short-term bullish; 9 EMA crossing above 20 EMA = bullish momentum shift.' },
  { id:45, cat:'technical', q:'What does a moving average "golden cross" indicate?', opts:['A stock hitting all-time highs','The 50-day MA crossing above the 200-day MA — a bullish long-term signal','Gold stocks outperforming','A specific candlestick pattern'], ans:1, exp:'A golden cross occurs when the 50-day moving average crosses above the 200-day moving average. It\'s considered a bullish long-term signal indicating the medium-term trend has turned above the long-term trend. The opposite — 50 MA crossing below 200 MA — is called a "death cross" (bearish).' },
  { id:46, cat:'technical', q:'What does MACD stand for and what does it measure?', opts:['Market Average Closing Data — tracks closing prices','Moving Average Convergence Divergence — measures momentum and trend changes','Momentum And Confirmation Data — confirms breakouts','Maximum Allowed Capital Drawdown — a risk metric'], ans:1, exp:'MACD (Moving Average Convergence Divergence) shows the relationship between two EMAs (typically 12 and 26 day). A MACD line crossing above the signal line is bullish; crossing below is bearish. The histogram shows the strength of the difference. It\'s a lagging indicator — best used for confirmation, not as the sole entry signal.' },
  { id:47, cat:'technical', q:'What does it mean when a stock "consolidates" on low volume?', opts:['The stock is failing and should be avoided','The stock is taking a healthy pause — supply and demand are in balance (often precedes a move)','The company is going through bankruptcy','Insiders are selling their shares'], ans:1, exp:'Low-volume consolidation (tight price action, lower-than-average volume) is often a healthy sign. It means neither buyers nor sellers have urgency — the stock is coiling. A breakout from a tight consolidation on high volume is one of the most reliable setups because it shows real conviction after a period of indecision.' },
  { id:48, cat:'technical', q:'What is the significance of a "volume spike" in the middle of the day?', opts:['It has no significance','A sudden volume spike can signal an institutional order, news, or momentum shift worth paying attention to','It means the stock is about to close','It indicates the stock will reverse exactly 15 minutes later'], ans:1, exp:'An unexpected volume spike in the middle of a normally slow session often means something significant: news (check the news feed immediately), institutional order, or a technical level being hit. It\'s worth noting and potentially acting on, depending on the direction and context of the price move accompanying it.' },

  // SCENARIOS
  { id:49, cat:'scenarios', q:'A stock is up 60% pre-market on a drug approval. You want to trade it. What\'s the smart move?', opts:['Buy immediately at market open for maximum gains','Short it — it\'s clearly overbought','Wait for price discovery (first 5-10 min) to settle, then look for a clear setup like a bull flag pullback or ORB','Place a limit order at the previous close price'], ans:2, exp:'Gapping stocks at open are unpredictable. The first minutes are chaos — massive spreads, volatile swings, institutional orders hitting. Professionals often wait for "price discovery" to finish (5-10 min), then look for a clean technical setup: an ORB breakout, bull flag, or VWAP hold. Chasing at open is the most common beginner mistake.' },
  { id:50, cat:'scenarios', q:'You\'re in a trade and your stop is hit. Your first instinct is to move the stop lower "just to give it more room." What should you do?', opts:['Move the stop — the stock always bounces eventually','Add to the position to lower your average','Honor the stop and exit. Moving stops is one of the most dangerous habits in trading','Hold until end of day and reassess'], ans:2, exp:'Moving your stop loss lower is called "stop chasing" and it\'s one of the most dangerous habits a trader can develop. Your stop was placed at the level that invalidates your trade thesis — once it hits, the trade is wrong. Moving it means you\'re no longer following your plan; you\'re hoping. Hope is not a strategy.' },
  { id:51, cat:'scenarios', q:'You\'ve lost 3 trades in a row. What is the correct response?', opts:['Double your position size to recover quickly','Switch to a completely different strategy','Review whether you\'re following your rules, reduce size if needed, and consider taking a break','Keep trading exactly the same — losing streaks always end'], ans:2, exp:'Losing streaks are normal — every trader has them. The correct response is NOT to size up or abandon your strategy. Review your last 3 trades: did you follow your rules? If yes, it might just be variance. If no, reduce size, slow down, and get back to basics. Sometimes the best trade is no trade.' },
  { id:52, cat:'scenarios', q:'A stock breaks above a 3-month resistance level, but volume is 40% below average. Do you take the breakout trade?', opts:['Yes — a breakout is a breakout','Yes, but with smaller size given the low volume','No — low volume breakouts have a much higher failure rate','Yes — resistance breaks are always valid'], ans:1, exp:'Low-volume breakouts fail much more often than high-volume ones. The lack of conviction suggests the move may be a "fake-out" (false breakout that traps buyers then reverses). If you take it, reduce your size significantly. Better approach: wait to see if volume picks up on the next candle before committing full size.' },
  { id:53, cat:'scenarios', q:'You have a $5,000 account and want to risk $50 per trade (1%). You see a setup on a $10 stock with a stop 50 cents below entry. How many shares do you buy?', opts:['500 shares','100 shares','250 shares','50 shares'], ans:1, exp:'Position size = $ risk ÷ (entry − stop) = $50 ÷ $0.50 = 100 shares. At $10 per share, that\'s a $1,000 position (20% of account). This keeps your dollar risk exactly $50 if stopped out. Notice: the question is NOT "how many shares can I afford?" but "how many shares controls my risk to $50?"' },
  { id:54, cat:'scenarios', q:'Your R:R is 1:1 and your win rate is 55%. After 100 trades, what is your approximate net result (before commissions)?', opts:['Breaking even','Profitable — +$500 per $100 risk unit','Losing money','Cannot be determined'], ans:1, exp:'Math: 55 wins × $100 = $5,500. 45 losses × $100 = $4,500. Net = +$1,000 (or +$500 per $100 risk unit). With a 1:1 R:R, you need >50% win rate to be profitable. At exactly 50% you break even (before commissions). With a better R:R (1:2), you could be profitable with only 34% wins.' },
  { id:55, cat:'scenarios', q:'A stock has 2 million float, 40% short interest, and just got an FDA approval catalyst. What type of move might you expect?', opts:['A slow, steady upward drift','A potential massive short squeeze with explosive price action','A guaranteed 10% gain','A sell-off because the news was already priced in'], ans:1, exp:'This is a textbook short squeeze setup: low float (limited supply), high short interest (lots of people who need to cover if price rises), and a strong catalyst (FDA approval = shorts are wrong). The combination can cause explosive moves. This doesn\'t guarantee a squeeze — but the conditions are ideal and the risk/reward is worth watching closely.' },
];

// ---- Quiz State ----
let _quizMode = 'quick';
let _quizCat  = 'all';
let _quizQs   = [];      // current question set
let _quizIdx  = 0;
let _quizScore = 0;
let _quizAnswered = false;
let _quizTimer = null;
let _quizTimeLeft = 30;
let _quizCatResults = {}; // { cat: { correct, total } }
let _quizHistory = JSON.parse(localStorage.getItem('td_quiz_history') || '[]');
let _lastMode   = 'quick'; // for retry

// ---- Category metadata ----
const CAT_META = {
  terms:     { label:'Terms',         color:'var(--accent)',  icon:'📖' },
  patterns:  { label:'Chart Patterns',color:'var(--accent2)', icon:'📊' },
  risk:      { label:'Risk Mgmt',     color:'var(--warn)',    icon:'⚠️' },
  orders:    { label:'Order Types',   color:'var(--gold)',    icon:'📋' },
  mechanics: { label:'Market Mech.',  color:'#a371f7',        icon:'⚙️' },
  psychology:{ label:'Psychology',    color:'#f0883e',        icon:'🧘' },
  technical: { label:'Technical',     color:'var(--accent)',  icon:'📉' },
  scenarios: { label:'Scenarios',     color:'var(--accent2)', icon:'🎬' },
};

// ---- Landing ----
function showQuizLanding() {
  document.getElementById('quiz-landing').style.display = '';
  document.getElementById('quiz-active').style.display  = 'none';
  document.getElementById('quiz-results').style.display = 'none';
  renderQuizHistory();
}

function selectCat(el, cat) {
  _quizCat = cat;
  document.querySelectorAll('.quiz-cat-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
}

// ---- Start quiz ----
function startQuiz(mode) {
  _lastMode = mode;
  _quizMode = mode;
  _quizScore = 0;
  _quizIdx = 0;
  _quizAnswered = false;
  _quizCatResults = {};

  let pool = [...QUIZ_BANK];

  if (mode === 'category' && _quizCat !== 'all') {
    pool = pool.filter(q => q.cat === _quizCat);
  } else if (mode === 'scenarios') {
    pool = pool.filter(q => q.cat === 'scenarios');
  } else if (mode === 'weakspots') {
    const stats = JSON.parse(localStorage.getItem('td_quiz_catstats') || '{}');
    // Find weakest categories (lowest %)
    const catPcts = Object.entries(stats).map(([c,s]) => ({ c, pct: s.total ? s.correct/s.total : 1 }));
    catPcts.sort((a,b) => a.pct - b.pct);
    if (catPcts.length) {
      const weakCats = catPcts.slice(0, 3).map(x => x.c);
      pool = pool.filter(q => weakCats.includes(q.cat));
    }
  }

  // Shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const count = (mode === 'timed') ? 25 : (mode === 'scenarios') ? pool.length : Math.min(10, pool.length);
  _quizQs = pool.slice(0, count);

  if (_quizQs.length === 0) {
    alert('No questions available for this selection. Try a different category.');
    return;
  }

  document.getElementById('quiz-landing').style.display  = 'none';
  document.getElementById('quiz-results').style.display  = 'none';
  document.getElementById('quiz-active').style.display   = '';

  const timed = mode === 'timed';
  document.getElementById('quiz-timer-display').style.display = timed ? '' : 'none';

  renderQuestion();
}

// ---- Render question ----
function renderQuestion() {
  if (_quizIdx >= _quizQs.length) { showResults(); return; }
  _quizAnswered = false;
  const q = _quizQs[_quizIdx];
  const total = _quizQs.length;
  const pct   = (_quizIdx / total) * 100;

  document.getElementById('quiz-q-counter').textContent = `Question ${_quizIdx+1} of ${total}`;
  document.getElementById('quiz-progress-bar').style.width = pct + '%';
  document.getElementById('quiz-live-num').textContent = _quizScore;

  const cm = CAT_META[q.cat] || { label: q.cat, color:'var(--accent)', icon:'❓' };
  document.getElementById('quiz-q-cat').innerHTML =
    `<span style="color:${cm.color}">${cm.icon} ${cm.label}</span>`;
  document.getElementById('quiz-q-text').textContent = q.q;
  document.getElementById('quiz-explanation').style.display = 'none';
  document.getElementById('quiz-result-badge').textContent = '';
  document.getElementById('quiz-next-btn').style.display = 'none';

  const letters = ['A','B','C','D'];
  document.getElementById('quiz-options').innerHTML = q.opts.map((opt, i) =>
    `<button class="quiz-opt" id="qopt-${i}" onclick="selectAnswer(${i})">
      <span class="quiz-opt-letter">${letters[i]}</span>
      ${opt}
    </button>`
  ).join('');

  // Timed mode
  if (_quizMode === 'timed') {
    _quizTimeLeft = 30;
    updateTimerDisplay();
    clearInterval(_quizTimer);
    _quizTimer = setInterval(() => {
      _quizTimeLeft--;
      updateTimerDisplay();
      if (_quizTimeLeft <= 0) {
        clearInterval(_quizTimer);
        if (!_quizAnswered) selectAnswer(-1); // time's up = wrong
      }
    }, 1000);
  }
}

function updateTimerDisplay() {
  const el = document.getElementById('quiz-timer-val');
  const wrap = document.getElementById('quiz-timer-display');
  if (el) el.textContent = _quizTimeLeft;
  if (wrap) wrap.className = 'quiz-timer' + (_quizTimeLeft <= 10 ? ' warn' : '');
}

// ---- Handle answer ----
function selectAnswer(chosen) {
  if (_quizAnswered) return;
  _quizAnswered = true;
  clearInterval(_quizTimer);

  const q = _quizQs[_quizIdx];
  const correct = chosen === q.ans;

  if (correct) {
    _quizScore++;
    document.getElementById('quiz-result-badge').textContent = '✅';
  } else {
    document.getElementById('quiz-result-badge').textContent = '❌';
  }

  // Highlight options
  document.querySelectorAll('.quiz-opt').forEach((btn, i) => {
    btn.classList.add('disabled');
    if (i === q.ans) btn.classList.add('correct');
    else if (i === chosen) btn.classList.add('wrong');
  });

  // Explanation
  const expEl = document.getElementById('quiz-explanation');
  expEl.style.display = '';
  expEl.innerHTML = `<strong>${correct ? '✅ Correct!' : '❌ Incorrect.'}</strong> ${q.exp}`;

  // Track cat results
  if (!_quizCatResults[q.cat]) _quizCatResults[q.cat] = { correct:0, total:0 };
  _quizCatResults[q.cat].total++;
  if (correct) _quizCatResults[q.cat].correct++;

  document.getElementById('quiz-live-num').textContent = _quizScore;
  document.getElementById('quiz-next-btn').style.display = '';
}

// ---- Next question ----
function nextQuestion() {
  _quizIdx++;
  if (_quizIdx >= _quizQs.length) { showResults(); return; }
  renderQuestion();
}

// ---- Results ----
function showResults() {
  clearInterval(_quizTimer);
  document.getElementById('quiz-active').style.display  = 'none';
  document.getElementById('quiz-results').style.display = '';

  const total = _quizQs.length;
  const pct   = Math.round((_quizScore / total) * 100);
  const el    = document.getElementById('quiz-final-score');
  el.textContent = pct + '%';
  el.style.color = pct >= 80 ? 'var(--accent2)' : pct >= 60 ? 'var(--gold)' : 'var(--warn)';

  document.getElementById('quiz-final-label').textContent = `${_quizScore} / ${total} correct`;

  const msgs = pct >= 90 ? '🏆 Excellent! You have a strong foundation.' :
               pct >= 75 ? '👍 Good work! A few areas to review.' :
               pct >= 60 ? '📚 Decent start — keep studying the explanations.' :
               '📖 Keep practicing. Review the explanations carefully.';
  document.getElementById('quiz-grade-msg').textContent = msgs;

  // Category breakdown
  const breakdown = document.getElementById('quiz-cat-breakdown');
  breakdown.innerHTML = Object.entries(_quizCatResults).map(([cat, s]) => {
    const cm   = CAT_META[cat] || { label: cat, color:'var(--accent)', icon:'❓' };
    const catPct = Math.round((s.correct / s.total) * 100);
    return `<div class="quiz-cat-score">
      <div class="cat-name">${cm.icon} ${cm.label}</div>
      <div class="cat-pct" style="color:${catPct>=80?'var(--accent2)':catPct>=60?'var(--gold)':'var(--warn)'}">${catPct}%</div>
      <div style="font-size:10px;color:var(--muted)">${s.correct}/${s.total}</div>
    </div>`;
  }).join('');

  // Persist cat stats for weak-spots mode
  const saved = JSON.parse(localStorage.getItem('td_quiz_catstats') || '{}');
  Object.entries(_quizCatResults).forEach(([cat, s]) => {
    if (!saved[cat]) saved[cat] = { correct:0, total:0 };
    saved[cat].correct += s.correct;
    saved[cat].total   += s.total;
  });
  dbSet('td_quiz_catstats', saved);

  // Save to history
  _quizHistory.unshift({ date: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'}), mode:_quizMode, score:pct, correct:_quizScore, total });
  if (_quizHistory.length > 10) _quizHistory.pop();
  dbSet('td_quiz_history', _quizHistory);
}

function retryQuiz() { startQuiz(_lastMode); }

function quitQuiz() { clearInterval(_quizTimer); showQuizLanding(); }

// ---- History ----
function renderQuizHistory() {
  const wrap = document.getElementById('quiz-history-wrap');
  const cont = document.getElementById('quiz-history');
  if (!_quizHistory.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  cont.innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap">` +
    _quizHistory.map(h =>
      `<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:12px;min-width:120px">
        <div style="font-weight:700;color:${h.score>=75?'var(--accent2)':h.score>=60?'var(--gold)':'var(--warn)'};font-size:18px">${h.score}%</div>
        <div style="color:var(--muted);font-size:10px">${h.date} · ${h.mode}</div>
        <div style="font-size:11px;color:var(--text)">${h.correct}/${h.total} correct</div>
      </div>`
    ).join('') + `</div>`;
}

// ---- AI Quiz Generation ----
async function generateAIQuiz() {
  const topic = document.getElementById('quiz-ai-topic').value.trim();
  const key   = localStorage.getItem('td_claude_key') || '';
  const status = document.getElementById('quiz-ai-status');
  const btn    = document.getElementById('quiz-ai-btn');

  if (!key) {
    status.style.color = 'var(--warn)';
    status.textContent = '⚠ No Claude API key found. Add it in the Live News tab (Settings) first.';
    return;
  }
  if (!topic) {
    status.textContent = 'Enter a topic first.';
    return;
  }

  btn.disabled = true;
  status.style.color = 'var(--muted)';
  status.textContent = '✨ Generating questions…';

  try {
    const prompt = `You are a day trading instructor. Generate exactly 5 multiple-choice quiz questions for a beginner day trader about: "${topic}".

Return ONLY a valid JSON array (no markdown, no explanation), like this:
[
  {
    "q": "Question text here?",
    "opts": ["Option A", "Option B", "Option C", "Option D"],
    "ans": 0,
    "exp": "Detailed explanation of why the correct answer is right and why the others are wrong."
  }
]

Rules:
- Each question must have exactly 4 options
- "ans" is the index (0-3) of the correct option
- Focus on practical, actionable knowledge a beginner day trader needs
- Make explanations educational and specific (2-3 sentences minimum)
- Vary difficulty slightly — 2 easy, 2 medium, 1 hard`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-allow-browser': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    const text = data.content[0].text.trim();

    // Parse — extract JSON array even if wrapped in extra text
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Could not parse JSON from response');
    const generated = JSON.parse(match[0]);

    // Add to bank with AI tag
    const aiQs = generated.map((q, i) => ({
      id: 'ai_' + Date.now() + '_' + i,
      cat: 'ai_' + topic.toLowerCase().replace(/\s+/g,'_').slice(0,20),
      q: q.q, opts: q.opts, ans: q.ans, exp: q.exp,
      aiTopic: topic,
    }));

    // Add to CAT_META
    const catKey = aiQs[0].cat;
    CAT_META[catKey] = { label: topic.slice(0,20), color:'#a371f7', icon:'🤖' };

    // Start quiz with AI questions
    _lastMode = 'ai';
    _quizMode = 'ai';
    _quizScore = 0;
    _quizIdx = 0;
    _quizAnswered = false;
    _quizCatResults = {};
    _quizQs = aiQs;

    document.getElementById('quiz-landing').style.display  = 'none';
    document.getElementById('quiz-results').style.display  = 'none';
    document.getElementById('quiz-active').style.display   = '';
    document.getElementById('quiz-timer-display').style.display = 'none';

    status.textContent = '';
    btn.disabled = false;
    renderQuestion();

  } catch(e) {
    status.style.color = 'var(--warn)';
    status.textContent = '⚠ Error: ' + e.message;
    btn.disabled = false;
  }
}

// ---- Init quiz ----
(function initQuiz() {
  _quizHistory = JSON.parse(localStorage.getItem('td_quiz_history') || '[]');
  renderQuizHistory();
})();

// ==================== KNOWLEDGE BASE ====================

// ---- Mastery tracking ----
let kbMastery = JSON.parse(localStorage.getItem('td_kb_mastery') || '{}');
let kbTags    = JSON.parse(localStorage.getItem('td_kb_tags')    || '{}');

function applyKbState() {
  document.querySelectorAll('.learn-card-collapsible').forEach(card => {
    const title = card.dataset.title;
    if (!title) return;

    // Mastery button state
    const btn = card.querySelector('.lc-mastery-btn');
    if (btn) {
      if (kbMastery[title]) {
        btn.textContent = '✓ Known';
        btn.classList.add('known');
        card.classList.add('lc-known');
      } else {
        btn.textContent = 'Mark as Known';
        btn.classList.remove('known');
        card.classList.remove('lc-known');
      }
    }

    // Tag badge
    const tagBadge = document.getElementById('lc-tag-' + title);
    const tagInput = card.querySelector('.lc-tag-input');
    if (kbTags[title]) {
      if (tagBadge) { tagBadge.textContent = kbTags[title]; tagBadge.style.display = ''; }
      if (tagInput) tagInput.value = kbTags[title];
    } else {
      if (tagBadge) tagBadge.style.display = 'none';
    }
  });
}

function toggleLearnCard(headerEl) {
  const card = headerEl.closest('.learn-card-collapsible');
  const body = card.querySelector('.lc-body');
  const isOpen = card.classList.contains('lc-open');
  if (isOpen) {
    card.classList.remove('lc-open');
    body.classList.remove('open');
  } else {
    card.classList.add('lc-open');
    body.classList.add('open');
  }
}

function toggleMastery(btn, title) {
  kbMastery[title] = !kbMastery[title];
  dbSet('td_kb_mastery', kbMastery);
  applyKbState();
}

function saveKbTag(btn, title) {
  const inp = btn.previousElementSibling;
  const val = inp.value.trim().toUpperCase();
  if (val) kbTags[title] = val;
  else delete kbTags[title];
  dbSet('td_kb_tags', kbTags);
  applyKbState();
}

function kbSearch() {
  const query = document.getElementById('kb-search').value.toLowerCase();
  const cards = document.querySelectorAll('#kb-cards-grid .learn-card-collapsible');
  let anyVisible = false;
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    const match = !query || text.includes(query);
    card.style.display = match ? '' : 'none';
    if (match) anyVisible = true;
  });
  const noRes = document.getElementById('kb-no-results');
  if (noRes) noRes.style.display = anyVisible ? 'none' : '';
}

// ---- Cheat sheet modal ----
function openCheatSheet() {
  document.getElementById('cheat-sheet-modal').style.display = '';
}
function closeCheatSheet(e) {
  if (!e || e.target === document.getElementById('cheat-sheet-modal')) {
    document.getElementById('cheat-sheet-modal').style.display = 'none';
  }
}

// ---- Strategy Notes ----
let strategyNotes = JSON.parse(localStorage.getItem('td_strategy_notes') || '[]');

function addStrategyNote() {
  const text = document.getElementById('kb-note-text').value.trim();
  if (!text) return;
  const cat = document.getElementById('kb-note-cat').value;
  strategyNotes.unshift({ text, category: cat, date: new Date().toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric'}) });
  dbSet('td_strategy_notes', strategyNotes);
  document.getElementById('kb-note-text').value = '';
  renderStrategyNotes();
}

function deleteStrategyNote(i) {
  strategyNotes.splice(i, 1);
  dbSet('td_strategy_notes', strategyNotes);
  renderStrategyNotes();
}

function renderStrategyNotes() {
  const container = document.getElementById('kb-notes-list');
  if (!container) return;
  if (!strategyNotes.length) {
    container.innerHTML = '<div class="empty-state">No notes yet. Add your first one above.</div>';
    return;
  }
  container.innerHTML = strategyNotes.map((n, i) => `
    <div class="kb-note-card">
      <div class="kb-note-card-top">
        <span class="kb-note-cat cat-${n.category.toLowerCase()}">${n.category}</span>
        <span class="kb-note-date">${n.date}</span>
        <button class="del-btn" onclick="deleteStrategyNote(${i})" style="margin-left:6px">×</button>
      </div>
      <div class="kb-note-text">${n.text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
    </div>`).join('');
}

// Init KB state on load
applyKbState();
renderStrategyNotes();

// ==================== FLASHCARD DRILL ====================

const FLASHCARDS = [
  {front:'Long', back:'Buying, betting price goes up', category:'Glossary'},
  {front:'Short', back:'Selling borrowed shares, betting price drops', category:'Glossary'},
  {front:'Float', back:'Shares available to trade. Low float = more volatile moves', category:'Glossary'},
  {front:'Spread', back:'Difference between bid and ask. Wide spread = harder to profit', category:'Glossary'},
  {front:'Support', back:'Price level where buying tends to emerge. Price bounces up from here', category:'Glossary'},
  {front:'Resistance', back:'Price level where selling tends to emerge. Price gets rejected here', category:'Glossary'},
  {front:'Breakout', back:'Price moves through a key level with above-average volume. Confirms move', category:'Glossary'},
  {front:'Gap Up/Down', back:'Price opens above/below previous close. Often driven by news or earnings', category:'Glossary'},
  {front:'VWAP', back:'Volume Weighted Average Price. Institutional benchmark. Price above = bullish bias', category:'Indicator'},
  {front:'EMA 9/20', back:'Fast moving averages. Price above both = uptrend. Cross below = warning', category:'Indicator'},
  {front:'RSI', back:'Momentum oscillator 0-100. Above 70 = overbought. Below 30 = oversold', category:'Indicator'},
  {front:'Volume', back:'Number of shares traded. High volume confirms breakouts and reversals', category:'Indicator'},
  {front:'ATR', back:'Average True Range. Measures volatility. Use to set stop-loss distance', category:'Indicator'},
  {front:'MACD', back:'Moving Average Convergence Divergence. Crossover above signal line = bullish', category:'Indicator'},
  {front:'Bull Flag', back:'Strong move up (pole), brief consolidation (flag), then continuation up', category:'Pattern'},
  {front:'Bear Flag', back:'Strong drop (pole), brief rally (flag), then continuation down', category:'Pattern'},
  {front:'Cup & Handle', back:'U-shaped base + small pullback = bullish breakout setup', category:'Pattern'},
  {front:'Head & Shoulders', back:'3-peak pattern (left shoulder, head, right shoulder) = trend reversal signal', category:'Pattern'},
  {front:'Doji', back:'Open ≈ Close, small body. Shows indecision. Often signals reversal', category:'Pattern'},
  {front:'Hammer', back:'Long lower wick, small body at top. Buyers pushed back sellers. Bullish reversal', category:'Pattern'},
  {front:'PDT Rule', back:'4+ day trades in 5 business days requires $25,000 minimum account balance', category:'Rule'},
  {front:'1-2% Risk Rule', back:'Never risk more than 1-2% of your total account on any single trade', category:'Rule'},
  {front:'1:2 R/R', back:'Minimum risk/reward ratio. If risking $100, target at least $200 gain', category:'Rule'},
  {front:'Opening Range', back:'First 15-30 min candle high/low. Mark these levels — breakout from range is a key entry signal', category:'Strategy'},
  // Additional Glossary
  {front:'Bid', back:'Highest price a buyer is willing to pay. You sell at the bid', category:'Glossary'},
  {front:'Ask', back:'Lowest price a seller will accept. You buy at the ask', category:'Glossary'},
  {front:'Market Order', back:'Buy or sell immediately at current market price. Fast execution, no price guarantee', category:'Glossary'},
  {front:'Limit Order', back:'Buy or sell only at your specified price or better. Price guarantee, no fill guarantee', category:'Glossary'},
  {front:'Stop Loss', back:'Order that triggers a sell if price falls to a specified level. Limits your maximum loss', category:'Glossary'},
  {front:'Margin', back:'Borrowed money from your broker to buy more than your cash allows. Amplifies both gains and losses', category:'Glossary'},
  {front:'Leverage', back:'Using borrowed capital or derivatives to control a larger position. 2:1 leverage = double exposure', category:'Glossary'},
  {front:'Scalping', back:'Very short-term trading strategy — holding seconds to minutes, targeting small gains repeatedly', category:'Glossary'},
  {front:'Swing Trade', back:'Holding positions for days to weeks to capture larger price swings. Opposite of day trading', category:'Glossary'},
  {front:'Pre-Market', back:'Trading before the 9:30 AM open (4–9:30 AM ET). Lower volume, wider spreads, more volatile', category:'Glossary'},
  {front:'Level 2', back:'Shows real-time bid/ask orders and sizes from all market makers. Reveals depth of buying and selling pressure', category:'Glossary'},
  {front:'Short Squeeze', back:'When short sellers are forced to buy to cover losses, rapidly driving price up. Often explosive and fast', category:'Glossary'},
  {front:'Catalyst', back:'News or event that triggers a significant price move: earnings, FDA approval, partnership announcement', category:'Glossary'},
  {front:'Halt', back:'Trading on a stock is paused by exchange. Can be news-related or volatility circuit breaker. Unpredictable resumption', category:'Glossary'},
  {front:'Wash Sale', back:'Selling a security at a loss then rebuying within 30 days — IRS disallows the tax deduction', category:'Glossary'},
  {front:'Relative Volume', back:'Current volume vs average volume for that time of day. RVOL 2.0 = 2x normal — signals unusual activity', category:'Glossary'},
  // Additional Indicators
  {front:'Bollinger Bands', back:'Moving average + 2 standard deviation bands. Price at upper band = overbought. At lower band = oversold', category:'Indicator'},
  {front:'Stochastic', back:'Momentum oscillator comparing close to range over N periods. Above 80 = overbought, below 20 = oversold', category:'Indicator'},
  {front:'OBV', back:'On Balance Volume. Adds volume on up days, subtracts on down days. Divergence from price signals trend change', category:'Indicator'},
  {front:'RVOL', back:'Relative Volume = current volume ÷ average volume. Above 2.0 confirms breakouts and news moves', category:'Indicator'},
  // Additional Patterns
  {front:'Double Top', back:'Two peaks at same resistance level. Neckline break = bearish reversal. Stronger with volume decline on 2nd peak', category:'Pattern'},
  {front:'Double Bottom', back:'Two troughs at same support level. Neckline break = bullish reversal. Signals end of downtrend', category:'Pattern'},
  {front:'Ascending Triangle', back:'Flat resistance + rising support. Bullish continuation. Break above resistance = entry signal', category:'Pattern'},
  {front:'Falling Wedge', back:'Narrowing price action with downward slope. Bullish reversal pattern. Breakout above upper trendline = entry', category:'Pattern'},
  {front:'Inside Bar', back:'Candle that fits entirely within the prior candle\'s range. Shows consolidation. Breakout of prior candle = entry', category:'Pattern'},
  {front:'Bullish Engulfing', back:'Large green candle fully engulfs prior red candle body. Strong bullish reversal signal, especially at support', category:'Pattern'},
  // Additional Rules & Strategy
  {front:'Wash Sale Rule', back:'Can\'t claim a tax loss if you rebuy the same security within 30 days before or after the sale', category:'Rule'},
  {front:'3-Strike Rule', back:'After 3 losing trades in a day, stop trading. Prevents emotional overtrading and account blow-ups', category:'Rule'},
  {front:'Risk of Ruin', back:'The probability of losing your entire account. Increases sharply when risking more than 2% per trade', category:'Rule'},
  {front:'VWAP Reclaim', back:'Price dips below VWAP then closes back above it with volume. Bullish signal — buyers regained control', category:'Strategy'},
  {front:'Gap Fill', back:'Price tends to return to pre-gap levels. Stocks that gap up often "fill the gap" by pulling back to prior close', category:'Strategy'},
  {front:'Parabolic Short', back:'Short selling a stock that has gone parabolic. Only valid after clear topping signs and volume exhaustion', category:'Strategy'},
  // Glossary continued
  {front:'After-Hours', back:'Trading after 4 PM ET close. Lower liquidity, wider spreads. Moves can reverse at next open', category:'Glossary'},
  {front:'Circuit Breaker', back:'Market-wide halt triggered at 7%, 13%, 20% SPY drops. Individual stocks halt on 10%+ moves in 5 min', category:'Glossary'},
  {front:'Dark Pool', back:'Private trading venues where large institutions trade away from public exchanges. Prints show up after the fact', category:'Glossary'},
  {front:'Dilution', back:'Company issues new shares, reducing existing shareholders\' ownership percentage. Bearish for stock price', category:'Glossary'},
  {front:'Warrants', back:'Right to buy stock at a fixed price before expiration. Often issued with SPACs. Can cause dilution when exercised', category:'Glossary'},
  {front:'Call Option', back:'Contract giving the right to BUY 100 shares at the strike price before expiration. Profits when stock rises', category:'Glossary'},
  {front:'Put Option', back:'Contract giving the right to SELL 100 shares at the strike price before expiration. Profits when stock falls', category:'Glossary'},
  {front:'Implied Volatility', back:'Market\'s forecast of a stock\'s future volatility. High IV = expensive options. Spikes before earnings', category:'Glossary'},
  {front:'Open Interest', back:'Total number of outstanding options contracts. High OI at a strike = magnet effect near expiration', category:'Glossary'},
  {front:'Consolidation', back:'Price moves sideways in a tight range. Coiling energy before a breakout. Volume typically decreases', category:'Glossary'},
  {front:'Uptrend', back:'Series of higher highs and higher lows. Bias is long. Buy pullbacks to support, not breakdowns', category:'Glossary'},
  {front:'Downtrend', back:'Series of lower highs and lower lows. Bias is short. Sell rallies to resistance, not breakouts', category:'Glossary'},
  {front:'52-Week High', back:'Highest price a stock has traded in the past year. Breakout above it = no resistance above, bullish signal', category:'Glossary'},
  {front:'Market Cap', back:'Total value of a company: share price × shares outstanding. Small cap <$2B, mid $2-10B, large >$10B', category:'Glossary'},
  {front:'EPS', back:'Earnings Per Share = Net Income ÷ Shares Outstanding. Key metric in earnings reports. Beat estimate = bullish catalyst', category:'Glossary'},
  {front:'Buying Power', back:'Total capital available to trade including margin. Day trade buying power is 4x your cash for pattern day traders', category:'Glossary'},
  {front:'Locate', back:'Shares your broker has available to borrow for shorting. Hard-to-borrow stocks have high locate fees', category:'Glossary'},
  {front:'Dead Cat Bounce', back:'Brief recovery in a sharply falling stock before continuing down. Lures in buyers at the wrong time', category:'Glossary'},
  {front:'Bull Trap', back:'False breakout above resistance that traps buyers before reversing down hard', category:'Glossary'},
  {front:'Bear Trap', back:'False breakdown below support that traps short sellers before reversing up hard', category:'Glossary'},
  {front:'Gap and Go', back:'Stock gaps up at open and continues higher with momentum. Enter on first pullback or breakout of opening candle', category:'Glossary'},
  {front:'Gap and Crap', back:'Stock gaps up but immediately fades, selling off all day. Trap for buyers who chase the open', category:'Glossary'},
  {front:'Exhaustion Gap', back:'Gap that occurs after a long trend, on high volume. Signals the trend may be ending, not continuing', category:'Glossary'},
  {front:'Window Dressing', back:'End-of-quarter buying by fund managers to make portfolios look good. Can create artificial price action in winners', category:'Glossary'},
  // Indicators continued
  {front:'SMA 200', back:'200-day Simple Moving Average. Major long-term trend line. Price above = bull territory. Below = bear territory', category:'Indicator'},
  {front:'Fibonacci Retracement', back:'Key levels (23.6%, 38.2%, 50%, 61.8%) where price commonly pulls back before continuing trend', category:'Indicator'},
  {front:'Volume Profile', back:'Shows volume traded at each price level. High volume node = strong support/resistance. Low volume = fast moves', category:'Indicator'},
  {front:'Williams %R', back:'Momentum oscillator similar to stochastic. Above -20 = overbought. Below -80 = oversold. -50 = neutral', category:'Indicator'},
  {front:'ADX', back:'Average Directional Index. Measures trend strength, not direction. Above 25 = strong trend. Below 20 = choppy', category:'Indicator'},
  {front:'Ichimoku Cloud', back:'All-in-one indicator: trend direction, support/resistance, and momentum. Price above cloud = bullish', category:'Indicator'},
  {front:'RSI Divergence', back:'Price makes new high but RSI makes lower high = bearish divergence. Signals weakening momentum', category:'Indicator'},
  {front:'MACD Histogram', back:'Difference between MACD line and signal line. Growing histogram = accelerating momentum. Shrinking = slowing', category:'Indicator'},
  {front:'EMA Crossover', back:'Short EMA crosses above long EMA = golden cross (bullish). Short crosses below long = death cross (bearish)', category:'Indicator'},
  {front:'Keltner Channels', back:'EMA with ATR-based bands. Price outside the channels = extreme move. Often used to confirm breakouts', category:'Indicator'},
  // Patterns continued
  {front:'Inverse Head & Shoulders', back:'3-trough pattern (right side up). Neckline breakout = bullish reversal. Signals end of downtrend', category:'Pattern'},
  {front:'Symmetrical Triangle', back:'Converging trendlines with equal slopes. Neutral — breakout direction determines bias. Watch for volume surge', category:'Pattern'},
  {front:'Rectangle', back:'Price bounces between two horizontal levels. Breakout from either level with volume is the trade', category:'Pattern'},
  {front:'Pennant', back:'Small symmetrical triangle after a strong move. Continuation pattern. Similar to flag but tighter consolidation', category:'Pattern'},
  {front:'Morning Star', back:'3-candle bullish reversal: large red, small-body candle (gap down), large green. Strong bottom signal', category:'Pattern'},
  {front:'Evening Star', back:'3-candle bearish reversal: large green, small-body candle (gap up), large red. Strong top signal', category:'Pattern'},
  {front:'Three White Soldiers', back:'Three consecutive long green candles, each opening within prior body. Strong bullish reversal or continuation', category:'Pattern'},
  {front:'Shooting Star', back:'Small body at bottom, long upper wick. Buyers pushed up but sellers took over. Bearish reversal at highs', category:'Pattern'},
  {front:'Tweezer Top', back:'Two candles with matching highs at resistance. Shows price rejected twice at same level. Bearish reversal', category:'Pattern'},
  {front:'Harami', back:'Small candle inside previous large candle body. Shows momentum slowing. Potential reversal if confirmed next candle', category:'Pattern'},
  // Rules continued
  {front:'Never Trade Without a Plan', back:'Define entry, stop, and target BEFORE entering. If you can\'t define all three, don\'t take the trade', category:'Rule'},
  {front:'Journal Every Trade', back:'Record entry, exit, setup type, emotion, and result. Without data, you can\'t identify patterns in your mistakes', category:'Rule'},
  {front:'Scale In, Not All-In', back:'Enter partial size first. Add only if price confirms your thesis. Reduces cost basis risk and emotional attachment', category:'Rule'},
  {front:'Don\'t Trade Illiquid Stocks', back:'Stocks with <500k daily volume have wide spreads and unpredictable fills. Avoid unless you know the catalyst', category:'Rule'},
  {front:'Separate Emotions From Setups', back:'Ask: would I take this setup if I had no prior trades today? If yes, it\'s the setup. If no, it\'s emotion', category:'Rule'},
  // Psychology
  {front:'Anchoring Bias', back:'Fixating on a price you paid or a target you set. The market doesn\'t know your cost basis — trade what\'s in front of you', category:'Psychology'},
  {front:'Confirmation Bias', back:'Seeking information that confirms your existing view. Dangerous when holding a losing trade and rationalizing', category:'Psychology'},
  {front:'Loss Aversion', back:'The pain of a $100 loss feels twice as strong as the joy of a $100 gain. Causes traders to hold losers too long', category:'Psychology'},
  {front:'Overconfidence', back:'After a winning streak, traders risk more and follow their plan less. Winning streaks end the same way they started — fast', category:'Psychology'},
  {front:'Recency Bias', back:'Overweighting recent events. After a big win, you think you\'re infallible. After a big loss, you think every trade will fail', category:'Psychology'},
  {front:'Revenge Trading', back:'Taking impulsive trades to recover a loss. Driven by emotion, not setup quality. Almost always makes losses larger', category:'Psychology'},
  {front:'Analysis Paralysis', back:'Overthinking a setup until the opportunity is gone. Caused by fear of being wrong. Cured by a predefined checklist', category:'Psychology'},
  {front:'FOMO', back:'Fear Of Missing Out. Causes buying at the top of a move just as smart money is selling. Destroys trading accounts', category:'Psychology'},
  {front:'Paper Hands', back:'Exiting a winning trade too early out of fear. Leaves money on the table. Cured by trailing stops and a target', category:'Psychology'},
  {front:'Process Over Outcome', back:'A good process can produce a loss. A bad process can produce a win. Judge your trading on the process, not one result', category:'Psychology'},
];

let _fcDeck = [];
let _fcIdx = 0;
let _fcGotIt = 0;
let _fcTotal = 0;
let _fcWeakCounts = {};
let _fcFlipped = false;
let _fcFilter = 'All';
let _fcWeakSpots = JSON.parse(localStorage.getItem('td_flashcard_weak') || '[]');

function setFcFilter(btn, cat) {
  _fcFilter = cat;
  document.querySelectorAll('.fc-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  fcBuildDeck();
}

function fcBuildDeck(deckOverride) {
  if (deckOverride) {
    _fcDeck = deckOverride.slice();
  } else {
    _fcDeck = (_fcFilter === 'All' ? FLASHCARDS : FLASHCARDS.filter(c => c.category === _fcFilter)).slice();
    // shuffle
    for (let i = _fcDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [_fcDeck[i], _fcDeck[j]] = [_fcDeck[j], _fcDeck[i]];
    }
  }
  _fcIdx = 0;
  _fcGotIt = 0;
  _fcTotal = _fcDeck.length;
  _fcWeakCounts = {};
  _fcFlipped = false;
  document.getElementById('fc-results').style.display = 'none';
  document.getElementById('fc-drill-area').style.display = '';
  fcRenderCard();
}

function fcRenderCard() {
  if (_fcIdx >= _fcDeck.length) { fcShowResults(); return; }
  const card = _fcDeck[_fcIdx];
  _fcFlipped = false;
  const inner = document.getElementById('card-inner');
  inner.classList.remove('flipped');
  document.getElementById('fc-front-term').textContent = card.front;
  document.getElementById('fc-back-def').textContent = card.back;
  const catBadge = document.getElementById('fc-cat-badge');
  catBadge.textContent = card.category;
  catBadge.style.background = {Glossary:'rgba(96,180,255,.15)',Indicator:'rgba(192,132,252,.15)',Pattern:'rgba(74,222,128,.15)',Rule:'rgba(251,91,82,.15)',Strategy:'rgba(251,191,36,.15)'}[card.category] || 'rgba(96,180,255,.15)';
  catBadge.style.color = {Glossary:'var(--accent)',Indicator:'var(--purple)',Pattern:'var(--accent2)',Rule:'var(--warn)',Strategy:'var(--gold)'}[card.category] || 'var(--accent)';
  document.getElementById('fc-btn-row').style.display = '';
  document.getElementById('fc-answer-row').style.display = 'none';
  document.getElementById('fc-flip-btn').textContent = 'Flip ▾';
  // progress
  document.getElementById('fc-progress-text').textContent = `Card ${_fcIdx + 1} of ${_fcDeck.length}`;
  document.getElementById('fc-progress-bar').style.width = (_fcDeck.length > 0 ? (_fcIdx / _fcDeck.length * 100) : 0) + '%';
}

function fcFlip() {
  _fcFlipped = true;
  document.getElementById('card-inner').classList.add('flipped');
  document.getElementById('fc-btn-row').style.display = 'none';
  document.getElementById('fc-answer-row').style.display = '';
}

function fcGotIt() {
  if (!_fcFlipped) return;
  _fcGotIt++;
  _fcIdx++;
  fcRenderCard();
}

function fcReviewAgain() {
  if (!_fcFlipped) return;
  const card = _fcDeck[_fcIdx];
  _fcWeakCounts[card.front] = (_fcWeakCounts[card.front] || 0) + 1;
  // put card at end of deck
  _fcDeck.push(_fcDeck.splice(_fcIdx, 1)[0]);
  fcRenderCard();
}

function fcShowResults() {
  document.getElementById('fc-drill-area').style.display = 'none';
  document.getElementById('fc-results').style.display = '';
  const weakCards = Object.entries(_fcWeakCounts).filter(([k,v]) => v >= 2).map(([k]) => k);
  _fcWeakSpots = weakCards;
  dbSet('td_flashcard_weak', _fcWeakSpots);
  document.getElementById('fc-results-score').textContent = `${_fcGotIt} / ${_fcTotal} Got it`;
  const weakEl = document.getElementById('fc-results-weak');
  if (weakCards.length) {
    weakEl.innerHTML = '<strong style="color:var(--warn)">Weak spots (reviewed 2+ times):</strong><br>' + weakCards.join(', ');
  } else {
    weakEl.textContent = 'No weak spots — great work!';
  }
  document.getElementById('fc-progress-text').textContent = `Done! ${_fcGotIt}/${_fcTotal}`;
  document.getElementById('fc-progress-bar').style.width = '100%';
}

function fcRetryWeak() {
  if (!_fcWeakSpots.length) { alert('No weak spots saved yet!'); return; }
  const deck = FLASHCARDS.filter(c => _fcWeakSpots.includes(c.front));
  if (!deck.length) { alert('No matching cards found.'); return; }
  fcBuildDeck(deck);
}

function fcRestartAll() {
  fcBuildDeck();
}

function fcShuffle() {
  fcBuildDeck();
  const card = document.getElementById('flashcard-wrap');
  if (card) { card.classList.add('shuffle-pulse'); setTimeout(() => card.classList.remove('shuffle-pulse'), 400); }
}

// Init flashcards
fcBuildDeck();

// ==================== SCENARIO DRILLS ====================

const SCENARIOS = [
  {
    situation: "AAPL gaps up 3% at open on earnings beat. Volume in first 5 min is 4x average. RSI is 74. Price is above VWAP.",
    options: ["A. Buy immediately — strong momentum", "B. Wait for first pullback to VWAP before entering long", "C. Short it — RSI is overbought", "D. Avoid — earnings gaps are always traps"],
    answer: 1,
    explanation: "RSI 74 means overbought in the short term. Waiting for a pullback to VWAP gives a better entry with a defined stop. Buying into a gap with RSI that high is chasing. Shorting against a strong earnings gap is high risk."
  },
  {
    situation: "You're long 200 shares of TSLA. Your stop is -$2.00 from entry. The stock drops $1.80. It bounces slightly. You're down $360.",
    options: ["A. Hold — it bounced, the stop was too tight", "B. Add more shares to lower your average cost", "C. Honor your stop if it breaks — you set it for a reason", "D. Move your stop lower to give it more room"],
    answer: 2,
    explanation: "Your pre-trade stop was set with logic. Moving it or averaging down are both ways of letting losers run. Averaging down on a losing trade violates core risk management. Honor your stop."
  },
  {
    situation: "A low-float stock (2M float) news-spikes up 80% in pre-market. It's now 9:35 AM and it's still climbing with no pullback.",
    options: ["A. Chase it — momentum is real", "B. Wait for a pullback and VWAP test before considering entry", "C. Short it — it's up 80%, it has to come back", "D. Scan for the next mover instead"],
    answer: 1,
    explanation: "Low-float parabolic moves are extremely dangerous to chase or short without confirmation. Waiting for a VWAP test or consolidation gives you a real setup with defined risk. Shorting a momentum stock into the move without a reversal signal is very high risk."
  },
  {
    situation: "You've already taken 3 trades today. Two were losers. Your account is down 2.5%. You see a strong setup forming.",
    options: ["A. Take it — you need to make back the losses", "B. Size down to half your normal position", "C. Stop trading for the day — you've hit your daily loss limit", "D. Take it at full size — the setup looks perfect"],
    answer: 2,
    explanation: "3 losing trades = stop for the day is a core discipline rule. Trading to 'make back' losses is revenge trading — one of the most dangerous mindsets. Protecting capital on bad days is what keeps you in the game long-term."
  },
  {
    situation: "SPY opens below yesterday's close. RSI is 28. Pre-market volume is 3x normal. Futures were down all night.",
    options: ["A. Buy the open — RSI is oversold, bounce incoming", "B. Wait — confirm stabilization before entering long", "C. Short everything at open", "D. It doesn't matter — RSI always works"],
    answer: 1,
    explanation: "RSI oversold doesn't mean buy immediately. In a strong downtrend, RSI can stay oversold for extended periods. Waiting for confirmation (price stabilizing, volume drying up, a reversal candle) is the correct approach."
  },
  {
    situation: "You enter a bull flag breakout on NVDA. It breaks out, then immediately reverses below your entry. Volume is light on the breakout.",
    options: ["A. Hold — breakouts always need time to develop", "B. Exit at your stop — light volume breakout was a warning sign", "C. Add more — the pattern is still valid", "D. Move your stop below the next support"],
    answer: 1,
    explanation: "A breakout on light volume is a red flag — it lacks conviction. Your stop exists for exactly this scenario. Exiting and preserving capital is correct. The pattern failing is new information; your stop should be honored."
  },
  {
    situation: "It's 3:45 PM. You have no positions. You spot a setup that looks solid. The market closes in 15 minutes.",
    options: ["A. Take it — 15 minutes is plenty of time", "B. Skip it — not enough time to manage the trade properly", "C. Take it but with double your normal size to maximize the short time", "D. Only take it if it's a short position"],
    answer: 1,
    explanation: "End-of-day trades with 15 minutes left give you almost no time to manage risk. Spreads widen near close, volatility is erratic, and you can't respond to moves properly. Skipping marginal end-of-day setups is discipline, not missed opportunity."
  },
  {
    situation: "A stock you've been watching forms a perfect technical setup. But there's a Fed announcement in 30 minutes.",
    options: ["A. Take the trade — the setup is too good to pass", "B. Wait until after the announcement to trade", "C. Take it with a wider stop to account for volatility", "D. Take it — Fed announcements don't affect individual stocks"],
    answer: 1,
    explanation: "Fed announcements can swing the entire market 1-3% in seconds. Even a perfect technical setup gets destroyed by macro volatility. Waiting for the announcement to pass before taking new positions is standard risk management."
  },
  {
    situation: "You're paper trading and having a great week — up 12%. You're thinking about switching to real money.",
    options: ["A. Switch now — you're ready, the results prove it", "B. One good week in paper trading doesn't mean you're ready", "C. Double your paper position sizes to simulate real pressure", "D. Start with a $50k real account to match your paper results"],
    answer: 1,
    explanation: "Paper trading success doesn't translate directly to live trading. Real money adds psychological pressure that changes decision-making. Most traders need consistent paper trading results over weeks, a clear strategy, and strict risk management before going live — and should start very small."
  },
  {
    situation: "MSTR is up 12% and you have a profit of $800 in the trade. Your target was $600. You're thinking of holding for more.",
    options: ["A. Hold indefinitely — let your winners run", "B. Take partial profits at target, move stop to breakeven on remainder", "C. Exit fully — you exceeded your target", "D. Add to the position since it's working"],
    answer: 1,
    explanation: "Locking in partial profits at your target while letting a portion ride with a breakeven stop is the professional approach. It guarantees a win while giving upside. Both 'hold forever' and 'exit fully' ignore the partial profit strategy that manages risk and captures extended moves."
  },
  {
    situation: "You scan pre-market and find a stock up 40% on a clinical trial approval. Float is 3M shares. It's 8:15 AM. You want in.",
    options: ["A. Buy now in pre-market — the move is real and news is confirmed", "B. Wait for the regular market open and watch the first few candles", "C. Short it — 40% is too extended", "D. Ignore it — biotech is always too risky"],
    answer: 1,
    explanation: "Pre-market has wide spreads and low liquidity — you can get filled at a terrible price and can't react properly. Waiting for the open lets you see real volume, direction, and a proper setup with defined risk. You don't need to be first. You need to be right."
  },
  {
    situation: "A stock breaks out of a 3-week base on 5x average volume. You enter. It moves up 4% then stalls. Your target is 8%. Do you hold or take profits?",
    options: ["A. Hold — your target is 8%, never exit before your target", "B. Take half off at 4%, move stop to breakeven on the rest", "C. Exit fully — a 4% gain is plenty", "D. Add to the position since it's working"],
    answer: 1,
    explanation: "Taking partial profits at 4% locks in a win and removes risk on the remaining shares. Moving your stop to breakeven means the worst case is now a scratch trade. This is position management — letting a portion ride while protecting the profit you've already made."
  },
  {
    situation: "You're watching Level 2. A stock is trying to break $50.00. You see a massive sell order of 500k shares sitting at $50.00. The stock is at $49.90.",
    options: ["A. Buy now — it's about to break $50", "B. Wait to see if the wall gets absorbed before entering", "C. Short it — that wall will stop the move", "D. Ignore Level 2 — it doesn't matter"],
    answer: 1,
    explanation: "A large sell wall at a round number is a real resistance level. It may get absorbed and price breaks through — but you don't know that yet. Waiting to see if buyers can chew through the wall before entering gives you confirmation. Entering before the wall breaks is anticipating, not reacting."
  },
  {
    situation: "You're short a stock. It starts to short squeeze — up 15% in 10 minutes. You're down significantly. You think it'll come back down.",
    options: ["A. Hold and wait — short squeezes always reverse", "B. Cover immediately and take the loss", "C. Add to your short — better average price", "D. Hold until it returns to your entry"],
    answer: 1,
    explanation: "Short squeezes can go parabolic and wipe accounts. There is no 'it has to come back' in a squeeze. Covering immediately caps your loss. Adding to a losing short during a squeeze is one of the most dangerous moves in trading. The market doesn't care about your analysis when momentum takes over."
  },
  {
    situation: "A stock has earnings tomorrow after close. It's up 2% today on anticipation. Your analysis says it'll beat estimates. You want to hold overnight.",
    options: ["A. Hold — your analysis is solid and the trend is up", "B. Day trade it today but close before the earnings print", "C. Buy more before close to maximize the potential move", "D. Short it — earnings always disappoint"],
    answer: 1,
    explanation: "Even when you're right about earnings, the market reaction is unpredictable. A stock can beat estimates and drop 10% on 'sell the news.' Holding overnight into a binary event is gambling, not trading. Day trading the momentum and closing flat before earnings is the disciplined play."
  },
  {
    situation: "You've been in a winning trade for 20 minutes. It's up $1.20 from your entry. Suddenly you feel euphoric and start thinking about how much you'll make if it goes to $5.",
    options: ["A. Let the feeling guide you — confidence is an edge", "B. Recognize this as emotional escalation — tighten your stop", "C. Add to the position to maximize the win", "D. Ignore your emotions, they're irrelevant to the trade"],
    answer: 1,
    explanation: "Euphoria in a winning trade is one of the most dangerous states. It leads to holding too long, adding at the top, and giving back gains. Recognizing the emotion and tightening your stop protects your profit. The feeling of 'this could go to $5' is a signal to be more disciplined, not less."
  },
  {
    situation: "You see a stock on social media with hundreds of people posting about it. It's up 60% today. Everyone says it's going higher. You have FOMO.",
    options: ["A. Buy in — the crowd is usually right about momentum stocks", "B. Avoid — social media pumps are chasing, not trading", "C. Short it immediately — it's overextended", "D. Buy a small amount just to participate"],
    answer: 1,
    explanation: "By the time a stock is trending on social media and everyone is talking about it, the smart money is often already selling into the hype. Buying because of FOMO is chasing — you're entering without a real setup, defined risk, or clear exit. The people posting are often already in; you'd be their exit liquidity."
  },
  {
    situation: "You have a $10,000 account. You see a $2 stock and want to buy 5,000 shares ($10,000 worth — your full account). Your stop is $0.10 below entry.",
    options: ["A. Buy it — you believe in the setup and the stop is tight", "B. Size down — risking $500 (5% of account) violates your risk rules", "C. Don't trade it — $2 stocks are too risky", "D. Use all of it — the tight stop means low risk"],
    answer: 1,
    explanation: "A $0.10 stop on 5,000 shares = $500 risk, which is 5% of the account. The 1-2% rule means max $100-$200 at risk. To risk only $200, you'd buy ~2,000 shares at most. The dollar amount of the stop, not the percentage, determines your position size. Tight stop ≠ small risk if you're oversized."
  },
  {
    situation: "A stock pulls back to its 20 EMA after a strong uptrend. Volume on the pullback is light. RSI has cooled from 72 to 52. Price holds the EMA and shows a hammer candle.",
    options: ["A. This is a valid long setup — EMA hold + hammer + light pullback volume", "B. Avoid — it already ran, the uptrend is over", "C. Short it — RSI was overbought at 72", "D. Wait for it to break below the EMA before deciding"],
    answer: 0,
    explanation: "This is a textbook pullback entry. Light volume on the pullback means sellers aren't aggressive. The hammer candle shows buyers stepping in at the EMA. RSI resetting to 52 removes the overbought condition. This is how healthy uptrends work — strong move, light pullback to key level, continuation."
  },
  {
    situation: "You exit a trade for a $200 loss. 10 minutes later the stock goes exactly where you thought. You missed a $600 gain. How do you handle the next trade?",
    options: ["A. Size up — you need to make back the $200 plus the missed $600", "B. Take the next valid setup at your normal size with no adjustment", "C. Avoid trading for the rest of the day — you're clearly off", "D. Only take trades where you're 100% confident to avoid another miss"],
    answer: 1,
    explanation: "A stopped-out trade that then works is painful — but the stop was correct at the time. You cannot trade based on hindsight. Sizing up to 'make back' missed gains is revenge trading on a 'ghost' loss. The next trade is independent. Normal size, normal process, no emotion from the previous trade."
  },
  {
    situation: "It's Monday morning. You had a terrible week last week — down 8%. You're eager to start fresh and get it back fast.",
    options: ["A. Start aggressive — momentum will help you recover quickly", "B. Start with smaller size until you rebuild confidence and consistency", "C. Take the week off entirely", "D. Only take trades with 3:1 R/R or better to catch up faster"],
    answer: 1,
    explanation: "After a losing week, your psychology is compromised even if you don't feel it. Starting with reduced size protects you while you get back in rhythm. Trying to 'get it back fast' is the mindset that turns a bad week into a blown account. Size restores when results restore — not the other way around."
  },
  {
    situation: "You're watching a stock form a bull flag on the 5-min chart. Everything looks perfect. But the overall market (SPY) is down 1.5% and still falling.",
    options: ["A. Take it — the individual setup is what matters", "B. Pass — trading against a weak market reduces your edge significantly", "C. Short the stock instead since the market is weak", "D. Take it but with a tighter stop"],
    answer: 1,
    explanation: "Market direction is the tide that lifts or sinks most boats. A bull flag in a falling market has much lower follow-through probability. The setup may look perfect technically, but you're fighting the current. The best long setups occur when SPY supports them. Passing on a good-looking setup in a bad environment is disciplined."
  },
  {
    situation: "You enter a trade. Immediately after entry, the spread widens significantly and you can barely get a fill. You're in the trade but stuck.",
    options: ["A. Hold — wide spreads don't affect the actual trade outcome", "B. Exit at market immediately and note this stock has liquidity issues", "C. Place a limit order to exit at your target", "D. Add more shares since the price is favorable"],
    answer: 1,
    explanation: "Wide spreads mean the market for this stock is illiquid. You'll lose money on every entry and exit just to the spread. If you're already in and spreads have widened dramatically, exiting quickly minimizes damage. A stock with persistent spread issues should be avoided entirely in the future."
  },
  {
    situation: "You've been practicing a specific setup (bull flag on 5-min with VWAP hold) for 3 weeks. Your win rate is 65% on paper. When should you start trading it live?",
    options: ["A. Now — 65% win rate on paper is excellent proof", "B. After 3 weeks live with very small size to test real execution", "C. Never — paper trading results don't translate", "D. When your win rate reaches 80% on paper"],
    answer: 1,
    explanation: "Paper trading validates the setup logic, but live trading introduces execution risk (slippage, emotional decisions, order types). The right step is to trade very small size live to test whether you can execute the setup under real conditions. A 65% win rate on paper is promising — but you need to prove you can replicate it live before scaling up."
  },
  {
    situation: "A stock you trade regularly just reported a massive earnings miss. It's down 18% pre-market. You think it's oversold.",
    options: ["A. Buy at open — 18% down is clearly oversold, a bounce is guaranteed", "B. Wait and watch — falling knives can keep falling", "C. Short more at open to capitalize on continued weakness", "D. Buy after confirming a base forms and volume dries up"],
    answer: 3,
    explanation: "Catching falling knives is one of the most common beginner mistakes. An 18% gap down can become 25% or 40% by end of day. Option D is the disciplined approach — waiting for the selling to exhaust, volume to dry up, and a base to form before considering a long. You're not buying a 'bounce', you're buying a confirmed reversal."
  },
  {
    situation: "You're up 6 trades in a row this week, all winners. You feel unstoppable. Your next setup looks 'obvious.' You're considering doubling your normal position size.",
    options: ["A. Double it — your edge is clearly working", "B. Stick to your normal size — winning streaks end without warning", "C. Triple it — momentum compounds", "D. Take the week off since you've already done well"],
    answer: 1,
    explanation: "Overconfidence after a winning streak is one of the most predictable account killers. Streaks end. When they do, oversized positions turn small losses into major drawdowns. Your process was working at normal size — keep it there. The streak didn't change your edge; it changed your psychology."
  },
  {
    situation: "SPY hits a circuit breaker and halts for 15 minutes (down 7%). You're long 3 positions. What do you do when trading resumes?",
    options: ["A. Hold all three — it'll bounce", "B. Panic sell everything immediately at market open", "C. Assess each position individually with a clear stop plan before trading resumes", "D. Add to all positions since prices are lower"],
    answer: 2,
    explanation: "A circuit breaker gives you time to think — use it. Panic selling into the open often catches the worst fills. Adding blindly into a market halt is reckless. The right move is to review each position: does your thesis still hold? Where is your stop? Have a plan ready for each before the market reopens."
  },
  {
    situation: "A stock you've been watching for a week just broke out to a 52-week high with 3x average volume. No news. You missed the first 5% move.",
    options: ["A. Chase it immediately — 52-week highs often keep running", "B. Wait for a pullback to the breakout level before entering", "C. Short it — it's extended with no news catalyst", "D. Ignore it — no news means it won't last"],
    answer: 1,
    explanation: "52-week high breakouts are statistically bullish — there's no overhead resistance. But you missed the initial move. Chasing 5% above the breakout level gives poor risk/reward. Waiting for a pullback back to the breakout level gives you a clean entry with a tight stop just below it. Patience here is an edge."
  },
  {
    situation: "It's 11:30 AM. The market is choppy — SPY has moved up and down 0.5% three times in 90 minutes with no clear direction. Volume is thin.",
    options: ["A. Keep trading — more trades = more opportunities", "B. Reduce size or stop trading — choppy midday markets destroy accounts", "C. Switch to a longer time frame chart to find clearer setups", "D. Trade more aggressively since the moves are predictable"],
    answer: 1,
    explanation: "The 11 AM–2 PM window is often the least productive for day traders. Volume dries up, spreads widen, and stops get hunted in directionless chop. Many professional traders avoid this window entirely. If you must trade, reduce size significantly. The best trade is often no trade during lunch hour."
  },
  {
    situation: "You buy a stock at $25.00 with a stop at $24.50. It drops to $24.52 and bounces back to $25.20. Your stop almost triggered. Do you adjust the stop?",
    options: ["A. Move the stop to $24.25 to give it more room", "B. Keep the stop at $24.50 — your original analysis set it there", "C. Move the stop to $25.00 (breakeven) since it recovered", "D. Exit now — it came too close to the stop"],
    answer: 1,
    explanation: "Moving a stop lower after it almost triggers is a trap. It means your original risk analysis was wrong or you're letting emotion override the plan. Keeping the stop where you set it maintains your original risk definition. Moving to breakeven at $25.20 is premature — wait for price to give you a real profit cushion first."
  },
  {
    situation: "You place a market order to buy 500 shares of a thinly traded stock. You expected to pay $10.00 but got filled at $10.35.",
    options: ["A. Hold — the fill price doesn't change the thesis", "B. Immediately sell — the slippage ruined your risk/reward", "C. Adjust your stop lower to account for the worse entry", "D. Add 500 more shares to average the entry down"],
    answer: 1,
    explanation: "A $0.35 slippage on a thinly traded stock immediately changed your risk/reward profile. Your stop was placed relative to a $10.00 entry — at $10.35, the same stop now represents a larger percentage loss. Selling and reassessing is correct. This is also a lesson: use limit orders on illiquid stocks, never market orders."
  },
  {
    situation: "A biotech stock you hold is waiting for FDA approval next Monday. It's a binary event — could go up 200% or down 80%.",
    options: ["A. Hold your full position over the weekend", "B. Sell before Friday close to avoid the binary risk", "C. Double your position to maximize the potential 200% gain", "D. Hold but buy puts as a hedge"],
    answer: 1,
    explanation: "Binary events are coin flips with extreme outcomes. Holding a full position into an FDA decision is speculation, not trading. Selling before Friday close takes a defined gain (or loss) and avoids the gap risk. If you want exposure to the event, size down to an amount you're genuinely comfortable losing completely — because that's a real outcome."
  },
  {
    situation: "You're watching a stock with an ascending triangle forming over 2 weeks. It's approaching the flat resistance line for the 4th time. Volume has been declining.",
    options: ["A. Buy now — 4 touches means the breakout is imminent", "B. Wait for the actual breakout above resistance with volume before entering", "C. Short it — the more times it tests resistance, the weaker it is", "D. The pattern is invalid after 4 touches — ignore it"],
    answer: 1,
    explanation: "An ascending triangle is bullish but the breakout is the signal, not the approach. Multiple tests of resistance can go either way. Buying before the breakout means you might sit through false starts or a breakdown. Waiting for price to close above resistance on volume confirms buyer conviction. The breakout is your entry trigger."
  },
  {
    situation: "You shorted a stock at $15. It's now at $13.50. You have $150 gain per 100 shares. The stock forms a hammer candle at a major support level with volume spiking.",
    options: ["A. Hold the short — you're up, let it run to zero", "B. Cover the short — a hammer at support signals buyers stepping in", "C. Add to the short — the support will break", "D. Move stop to $14.00 and hold"],
    answer: 1,
    explanation: "A hammer candle at major support with volume is a strong reversal signal — exactly what short sellers fear. You have a $150/100 shares gain. Covering here locks in profit and respects the signal. Holding through a reversal signal turns a winner into a loser. Take the gain; reshort if the support breaks later with confirmation."
  },
  {
    situation: "You use ATR to set stops. The stock's ATR is $0.80. You enter long at $20.00. Where should your initial stop be?",
    options: ["A. $19.95 — tight stops preserve more capital", "B. $19.20 — 1x ATR below entry gives the trade room to breathe", "C. $18.40 — 2x ATR gives maximum room", "D. $19.50 — round number, easy to remember"],
    answer: 1,
    explanation: "Setting a stop at 1x ATR below entry ($19.20) respects the stock's natural volatility range. A stop at $19.95 is almost guaranteed to be hit by random noise — the stock routinely moves $0.80 in a day. 2x ATR makes the trade too large relative to your account (to keep risk at 1-2%, you'd need to size down too much). 1x ATR is the standard baseline."
  },
  {
    situation: "You enter a long position. The stock does nothing for 45 minutes — just oscillates in a $0.15 range. Your capital is tied up.",
    options: ["A. Hold indefinitely — it'll move eventually", "B. Exit if it doesn't move meaningfully within your time frame — use a time stop", "C. Add more since you've defined the range tightly", "D. Lower your stop to give it more room"],
    answer: 1,
    explanation: "A time stop is as valid as a price stop. If your thesis was a momentum move and the stock is doing nothing, the thesis is wrong. Your capital has opportunity cost. Exiting a stalled trade frees capital for setups that are actually working. 'It'll eventually move' is hope, not a trading plan."
  },
  {
    situation: "You're profitable for 3 months in a row on paper. A friend who trades says you should use a live account with at least $25,000 to 'do it properly.'",
    options: ["A. Agree — you need $25k to avoid the PDT rule and trade properly", "B. Start live with a small amount ($500-$2,000) you can afford to lose entirely", "C. Keep paper trading until you have $25k saved", "D. Use a cash account — no PDT rule applies"],
    answer: 1,
    explanation: "Starting live with a small amount you can fully afford to lose is the right bridge from paper to live. The psychological difference of real money is something you must experience in small doses first. A cash account is also a valid option (D has merit) — no PDT restriction, but you must wait for funds to settle. The key is: start small, real money, treat it as tuition."
  },
  {
    situation: "A sector ETF (XLE - energy) is up 3% today on oil news. You find an individual energy stock that hasn't moved yet. It looks like it's 'lagging.'",
    options: ["A. Buy the laggard — it'll catch up to the sector", "B. Investigate why it's not moving before assuming it will catch up", "C. Short the strong movers in XLE since they're overextended", "D. Buy the ETF instead — safer than individual stocks"],
    answer: 1,
    explanation: "A 'lagging' stock often has a reason — bad earnings, insider selling, specific bad news, or heavy short interest. It may not catch up at all. Before trading sector rotation, investigate why it hasn't moved. If the reason is unknown and it looks clean technically, it may be a valid trade — but assumption is not a strategy."
  },
  {
    situation: "You're looking at two setups simultaneously: a bull flag on NVDA (high conviction) and a consolidation breakout on a low-float biotech (higher risk, higher potential).",
    options: ["A. Take both — more trades = more profit potential", "B. Take the NVDA bull flag — higher conviction, defined risk, liquid market", "C. Take the biotech — higher reward is worth the risk", "D. Take neither — two setups at once is too complicated"],
    answer: 1,
    explanation: "When you have two setups, take the higher-conviction one. NVDA is liquid, the pattern is well-defined, and risk is controllable. The biotech may have a bigger potential move but lower probability and harder execution. Focus beats diversification in active trading. More trades doesn't mean more profit — it means more complexity and more chances to break your rules."
  },
  {
    situation: "Your broker sends a margin call. You need to deposit $2,000 or liquidate positions within 3 business days.",
    options: ["A. Liquidate your worst position immediately and deposit the difference", "B. Deposit the full amount and hold all positions", "C. Wait the 3 days hoping positions recover", "D. Close all positions and reset with cash only"],
    answer: 3,
    explanation: "A margin call means your account fell below the minimum — something went wrong. Waiting 3 days hoping for recovery risks having the broker liquidate at the worst possible prices. Immediately closing all positions and resetting cash-only is the safest reset. Trading on margin while learning adds enormous risk. Address the root cause: why were you using margin? Build the habit of trading only what you own."
  },
  {
    situation: "You're 8 trades into a strategy that's working. Your win rate is 70%. You decide to skip your entry rules on one trade because you 'feel' the setup is right.",
    options: ["A. It's fine — your intuition is informed by experience", "B. Don't take it — skipping your rules even once erodes the system", "C. Take it but note it separately in your journal", "D. Take it at half size as a compromise"],
    answer: 1,
    explanation: "The 70% win rate exists because of the rules, not despite them. Skipping rules 'just this once' is the beginning of discretionary drift — where your system gradually erodes until it's unrecognizable. If you consistently feel like skipping a rule, test whether modifying the rule improves results. But don't abandon the system mid-trade based on feeling."
  },
  {
    situation: "You're watching Level 2 on a stock. You see a large buy order appear at the bid — 100k shares. The stock immediately starts moving up.",
    options: ["A. Buy immediately — someone big is buying", "B. Watch for confirmation — large orders can be spoofed and pulled", "C. Fade it — large orders are always manipulative", "D. Ignore Level 2 data entirely"],
    answer: 1,
    explanation: "Spoofing is real — large orders appear to move price then disappear before filling. A 100k bid doesn't mean it'll execute. Watching whether the order actually gets filled and whether price follows through is critical. If the large order holds and price is moving through resistance with volume, that's confirmation. The order alone is not your signal."
  },
  {
    situation: "It's 9:31 AM. A stock gapped up 8% on earnings. The first 1-minute candle is a massive green candle. Do you buy at 9:32?",
    options: ["A. Yes — the first candle shows strong momentum, buy immediately", "B. No — wait at least 5 minutes to see if the gap holds or fades", "C. Short it — the first candle is always the top", "D. Wait for the 15-minute opening range to form"],
    answer: 1,
    explanation: "The first 1-5 minutes after a gap are the most volatile and unpredictable. Institutions are still routing orders, retail FOMO buyers are piling in, and market makers are adjusting. A gap can reverse completely in 3 minutes. Waiting 5+ minutes (many experienced traders wait 15-30 min) lets the dust settle and reveals whether buyers have real conviction."
  },
  {
    situation: "A stock is in a strong downtrend — lower lows every day for 2 weeks. Today it's up 4% with above-average volume. You want to buy.",
    options: ["A. Buy — the trend is reversing with this volume", "B. Wait for 2-3 days of higher highs and higher lows before considering long", "C. Short it — it's just a dead cat bounce", "D. Buy a small position as a starter"],
    answer: 1,
    explanation: "One good day in a downtrend is not a reversal — it's often a dead cat bounce or short covering. The trend is down until it proves otherwise with sustained price action. Waiting for 2-3 days of higher highs and higher lows gives confirmation that the character has genuinely changed. Buying after one reversal candle in a downtrend is a common trap."
  },
  {
    situation: "You're long a stock. Breaking news comes out mid-trade: the CEO resigned unexpectedly. The stock drops 6% in seconds.",
    options: ["A. Hold — the stock was technically strong before the news", "B. Exit immediately — unexpected executive departure is a fundamental change", "C. Buy more — the technical setup is still intact", "D. Wait to see the official press release before deciding"],
    answer: 1,
    explanation: "Unexpected CEO resignations are material news that changes the fundamental picture. Your trade thesis was based on conditions that no longer exist. Technical analysis doesn't override major unexpected news. Exit first, analyze later. You can always re-enter if the picture clears. The 6% drop may just be the beginning."
  },
  {
    situation: "You have $5,000 in your account. You want to trade a $200 stock (NVDA). Your stop is $2.00 below entry, risking 1% ($50). How many shares should you buy?",
    options: ["A. 25 shares ($5,000 full account)", "B. 5 shares ($1,000) — 1% account risk at $2.00 stop = $50 max loss / $10 per share risk = 5 shares", "C. 10 shares to make it worthwhile", "D. 1 share — minimum exposure on expensive stocks"],
    answer: 1,
    explanation: "Position sizing math: 1% of $5,000 = $50 max risk. Stop distance = $2.00 per share. Shares = $50 ÷ $2.00 = 25 shares. But wait — 25 shares of a $200 stock is $5,000, your entire account. The correct answer needs both: max risk AND available capital. Here 25 shares is the risk-correct size, but verify you have the buying power. The formula: Max loss ÷ (entry - stop) = shares."
  },
  {
    situation: "You notice your last 5 trades all had the same mistake: you exited your winners too early and let your losers run too long. What's the fix?",
    options: ["A. Take smaller positions so individual outcomes matter less", "B. Set hard targets and stops before entry and commit to honoring them", "C. Trade less frequently until confidence returns", "D. Review more charts to find better setups"],
    answer: 1,
    explanation: "Exiting winners early and holding losers is the most common trading mistake — it's driven by loss aversion and the dopamine hit of locking in gains. The fix is pre-defining your target and stop before entry, and not touching them unless there's a fundamental change in the setup. More charts won't fix psychology. Rules will."
  },
  {
    situation: "You're considering a trade in a stock with a bid of $10.00 and an ask of $10.40. The spread is $0.40.",
    options: ["A. Take the trade if your target is $11.00", "B. Avoid — a $0.40 spread means you're immediately down $0.40 on entry, destroying your risk/reward", "C. Place a limit order at $10.20 to split the spread", "D. Use a market order for guaranteed fill"],
    answer: 1,
    explanation: "A $0.40 spread on a $10 stock is 4% — you're immediately down 4% the moment you enter. Your target of $11 ($1.00 move) is now effectively a $0.60 move after paying the spread. This destroys your risk/reward. Wide spreads are a red flag on any stock. This is why stock selection matters: trade liquid stocks with tight spreads (pennies, not dollars)."
  },
  {
    situation: "It's options expiration Friday. A stock has massive open interest at the $50 strike. It's currently trading at $49.80.",
    options: ["A. Buy calls — it'll pin at $50 which means it'll run up", "B. Be aware that pinning behavior can lock price near $50 — avoid complex trades near major strikes on expiration", "C. Short it — it won't go above $50", "D. Options expiration has no effect on stock price"],
    answer: 1,
    explanation: "Max pain and pinning are real phenomena — market makers hedge options by buying/selling underlying shares, which can attract price toward high-OI strikes on expiration Friday. This creates unpredictable, often choppy price action near those levels. For day traders, trading around major OI strikes on expiration Friday is a minefield. Awareness of pinning keeps you from misreading the action."
  },
  {
    situation: "You've been following a trading educator on social media. They post a 'live trade' — going big into a penny stock. They have 500k followers.",
    options: ["A. Follow the trade quickly before the price moves more", "B. Ignore it — this is a potential pump and you'd be the exit liquidity", "C. Buy a small amount to learn from the trade in real time", "D. Research the stock first, then follow if the thesis is solid"],
    answer: 1,
    explanation: "When a social media influencer with 500k followers announces a trade in a small, low-float stock, the pump has already started. By the time you see the post and buy, you're likely buying from the influencer's followers who got in earlier. This is a textbook pump and dump setup. The only education here is recognizing it and walking away."
  },
  {
    situation: "You're analyzing a trade. Your technical analysis says buy, but an economic report (CPI data) releases in 20 minutes. The expected number is 'market-moving.'",
    options: ["A. Enter now and hold through the report", "B. Wait until after the report to take any new positions", "C. Enter with a stop wide enough to survive the volatility", "D. Only enter if the report is 'likely' to be positive"],
    answer: 1,
    explanation: "CPI, PPI, and jobs data can move the entire market 1-3% in one minute. A perfect technical setup gets completely overridden by macro data. Nobody — not you, not hedge funds — reliably predicts market reaction to economic reports. Waiting 5-10 minutes after the data drops and letting the market digest it before entering is standard practice."
  },
  {
    situation: "A stock you sold yesterday for a $300 loss has gone up 20% today. You feel sick about it and want to buy back in.",
    options: ["A. Buy it — clearly you made a mistake selling", "B. Evaluate it as a completely new trade setup, not as a recovery trade", "C. Don't buy it — you already lost money on it", "D. Buy it to 'make back' the $300 loss"],
    answer: 1,
    explanation: "This is anchoring — you're connecting the current trade to a past loss. The stock doesn't know you sold it. Whether you buy back in should be based purely on whether the current setup meets your criteria: is there a valid pattern, defined risk, and good risk/reward? The $300 loss is irrelevant. If the setup is valid, it's a new trade. If not, pass."
  },
  {
    situation: "You see a headline: 'ANALYST UPGRADES STOCK TO BUY WITH $X PRICE TARGET.' The stock immediately pops 5%.",
    options: ["A. Buy immediately — analyst upgrades are reliable signals", "B. Wait to see if the pop holds or fades after the initial reaction", "C. Short it — analyst upgrades are always sell signals", "D. The price target tells you exactly where it'll go — buy now"],
    answer: 1,
    explanation: "Analyst upgrades cause a kneejerk pop but are not reliable price predictors. The stock may pop 5% and immediately give it back as early buyers take profits into the news. Waiting to see if the upgrade-driven move holds its gains reveals whether real money is following the call. Many upgrades are 'buy the rumor, sell the news' scenarios."
  },
  {
    situation: "You're thinking about trading an IPO on its first day. The stock opens 40% above its IPO price.",
    options: ["A. Buy at open — IPOs that open up 40% have strong demand", "B. Avoid trading IPOs on day one — the price discovery is chaotic and manipulated by underwriters", "C. Short it — 40% above IPO price is overextended", "D. Buy a small speculative position for the hype"],
    answer: 1,
    explanation: "IPO day trading is extremely difficult. Underwriters actively support the price, there's no price history to analyze, the float is artificial (most shares are locked up), and volatility is extreme in both directions. Most professional day traders avoid trading IPOs until at least day 2-3 when real price discovery begins. The first day is not a normal market."
  },
  {
    situation: "You have a trade open. You're up $400 — exactly your daily goal. It's 10:15 AM. The setup still looks strong.",
    options: ["A. Keep trading — you haven't reached your potential for the day", "B. Stop trading for the day — you hit your goal, protect it", "C. Let this trade run but take no new positions", "D. Double your size on the next trade to maximize a hot day"],
    answer: 2,
    explanation: "Stopping when you hit your daily goal is a valid, professional approach — especially while developing consistency. The risk is that continuing after your goal is met introduces emotional trading (defending gains, taking extra risk). Option C is also reasonable — letting the current trade run with a trailing stop while avoiding new entries is a disciplined middle ground. The key: don't give back your daily goal through overtrading."
  },
  {
    situation: "Your entry criteria requires RSI to be below 40 for a long setup. RSI is at 43 on the stock you want to trade. Everything else checks out.",
    options: ["A. Take it — 43 is close enough to 40", "B. Pass — 43 doesn't meet your criteria. Wait for a better setup", "C. Take it at half size since it's close", "D. Lower your RSI requirement to 45 so you can take more trades"],
    answer: 1,
    explanation: "Your rules exist for a reason — they define the edge. Taking trades 'close enough' to your criteria is how systems degrade. If RSI 43 consistently produces the same results as RSI 38, test that hypothesis properly and adjust your rule. Don't adjust in real-time on individual trades. The discipline to pass on marginal setups is what keeps your win rate intact."
  },
  {
    situation: "You've been trading 6 months. You're consistently profitable on paper but every time you switch to live, you make emotional mistakes. What's actually happening?",
    options: ["A. Your strategy doesn't work with real money — abandon it", "B. Real money triggers emotional responses paper trading doesn't. The fix is process, not strategy", "C. You need a better computer setup to execute faster", "D. Trade even smaller size until the emotions go away completely"],
    answer: 1,
    explanation: "The strategy isn't the problem — it works on paper. The gap is psychological. Real money activates fear, greed, and ego in ways fake money never does. The fix is building process discipline with very small live size until the emotional responses habituate. Journaling every trade, reviewing each night, and being honest about rule violations builds the mental muscle. The emotions never disappear entirely — you learn to trade through them."
  },
  {
    situation: "A stock breaks out to a new 52-week high, but the breakout happens in the last 10 minutes of the trading day.",
    options: ["A. Buy immediately — end-of-day breakouts are the strongest", "B. Wait to see if it opens above the breakout level the next morning", "C. Buy half size and add tomorrow if it holds", "D. Short it — end-of-day moves always reverse overnight"],
    answer: 1,
    explanation: "Late-day breakouts on low volume are often window dressing or thin-market moves that don't hold. Waiting for the next morning's open tells you whether the breakout has real commitment: did it open higher, gap up, or reverse? If it opens strong and holds above the breakout level in the first 15 minutes, that's confirmation. Chasing end-of-day moves often means holding through gap risk overnight."
  },
  {
    situation: "You've been trading the same setup for 2 months with a 55% win rate and 1:2 R/R. This month you hit a 10-trade losing streak. Do you change your strategy?",
    options: ["A. Yes — 10 losers in a row proves the strategy stopped working", "B. No — review for execution errors first. 10 losses is within normal variance for a 55% win rate", "C. Take a break and come back with a completely different approach", "D. Double your size to recover the losses faster"],
    answer: 1,
    explanation: "With a 55% win rate, a 10-trade losing streak is statistically possible — not common, but real. Before abandoning the strategy, audit each of the 10 trades: did you follow the rules? Were there external conditions (high VIX, earnings season, thin market) that affected the setups? Strategy changes should be data-driven over 50+ trades, not reactive to a streak that falls within normal variance."
  },
  {
    situation: "You see a stock down 30% from its 52-week high. A friend says 'it was at $100, now it's at $70 — it's a bargain.' You're considering buying.",
    options: ["A. Buy — 30% off is clearly a discount", "B. A stock being down 30% tells you nothing about where it goes next — analyze the current setup", "C. Short it — stocks that fall 30% always go lower", "D. Buy half position and wait for it to return to $100"],
    answer: 1,
    explanation: "This is anchoring to a past price. A stock at $70 that was at $100 is not 'on sale' — it's a stock the market has decided is worth $70 (or less). The $100 price has no bearing on where it goes from here. Analyze the current fundamentals, chart structure, and catalyst. Many 'bargain' stocks continue lower. The prior high is irrelevant without a concrete reason for recovery."
  },
  {
    situation: "You're short a low-float stock. Suddenly you see it's been halted. When trading resumes 10 minutes later, it opens 25% higher than where it halted.",
    options: ["A. Hold — halts always resolve lower eventually", "B. Cover immediately at market on the resumption — the halt changed everything", "C. Add to the short since it's even more overextended now", "D. Wait for it to come back down to your entry before covering"],
    answer: 1,
    explanation: "A halt that resolves 25% higher means news came out — typically positive (buyout, FDA approval, etc.). The entire basis of your short has changed. Cover immediately on resumption regardless of price. The pain of covering 25% higher is far smaller than the risk of a further 50% squeeze. When the fundamental picture changes via halt, the trade is over."
  },
  {
    situation: "You're considering adding options to your trading. You buy a call option on TSLA expiring in 2 days. The stock moves up 1%, but your option loses value. Why?",
    options: ["A. The broker made a mistake — calls always profit when the stock goes up", "B. Theta decay — short-dated options lose value daily even if the stock moves in your favor", "C. You bought the wrong option — calls go down when stocks go up", "D. Options are random — nobody understands them"],
    answer: 1,
    explanation: "Theta decay destroys short-dated options value daily — sometimes faster than the stock can move in your favor. A 2-day option has almost no time value left. The stock moved 1% but if implied volatility contracted after the move, your option could lose value despite being 'right' on direction. This is why learning options without understanding the Greeks is dangerous. Theta, delta, and IV all affect your P&L simultaneously."
  },
  {
    situation: "You want to trade pre-market. A stock is at $20 pre-market, up from $17 close. Bid is $19.50, ask is $20.50.",
    options: ["A. Buy at market — you'll get filled around $20", "B. Avoid — a $1.00 spread pre-market means you're immediately down 5%", "C. Place a limit at $19.80 to get a better entry", "D. Always use market orders for speed in pre-market"],
    answer: 1,
    explanation: "Pre-market spreads are brutal. A $1.00 spread on a $20 stock is 5% — you're immediately down 5% on entry before the stock moves a penny. Market orders in pre-market are especially dangerous because you have no idea where you'll get filled. If you trade pre-market, always use limit orders, and factor the spread into your risk/reward calculation. Most retail traders are better served waiting for the regular session open."
  },
  {
    situation: "You've made $1,200 in profits this week. It's Friday at 2 PM. You're considering one more trade.",
    options: ["A. Take it — one more trade on a hot week makes sense", "B. Protect the week — Friday afternoon is notoriously volatile and low-quality for setups", "C. Take it only if it's your highest-conviction setup of the week", "D. Always take every setup regardless of day or time"],
    answer: 1,
    explanation: "Friday afternoon is one of the worst times to trade: volume drops, spreads widen, institutional desks close out positions causing erratic moves, and the risk of giving back a winning week is high. After a $1,200 week, the risk/reward of another trade is unfavorable — you're risking a meaningful chunk of weekly profit for a marginal setup. Protecting weekly gains is a legitimate professional strategy."
  },
  {
    situation: "A stock you trade has a short interest of 35% of the float. It's been moving up slowly for 3 days. Volume is increasing each day.",
    options: ["A. Short it — high short interest means it'll go down", "B. Be cautious about shorting — high short interest + rising price is a short squeeze setup", "C. Buy it — short squeezes are guaranteed to continue", "D. Short interest doesn't affect price action"],
    answer: 1,
    explanation: "35% short interest means more than a third of available shares are sold short. As the stock rises, short sellers face losses and must cover (buy shares), which drives price higher, forcing more shorts to cover — a feedback loop. This is a squeeze. Shorting into high short interest with rising price and volume is extremely dangerous. Long traders recognize this as a potentially explosive setup."
  },
  {
    situation: "You journal your last 30 trades and find your win rate drops to 35% on trades taken after 2 PM but is 65% before noon. What do you do?",
    options: ["A. Keep trading your normal schedule — it's a small sample size", "B. Stop trading after 2 PM — your data shows your edge disappears in the afternoon", "C. Trade more in the afternoon to improve your afternoon win rate", "D. Switch entirely to afternoon trading to force improvement"],
    answer: 1,
    explanation: "This is exactly what journaling is for. Your data clearly shows a time-of-day edge. Cutting out afternoon trading isn't quitting — it's optimizing. Professional traders ruthlessly eliminate low-edge periods. Trading more in the afternoon to 'get better' at it means trading with a negative edge while paying commissions and taking losses. Use your edge when it exists; stop when it doesn't."
  },
  {
    situation: "You have a $8,000 account. You want to risk 1% per trade ($80). A setup has a $0.40 stop. How many shares should you buy?",
    options: ["A. 20 shares", "B. 200 shares", "C. 80 shares", "D. 400 shares"],
    answer: 1,
    explanation: "Position sizing formula: Max Risk ÷ Stop Distance = Shares. $80 ÷ $0.40 = 200 shares. This is the only correct answer. 20 shares would only risk $8 (0.1% of account — undersized). 80 shares risks $32. 400 shares risks $160 (2% — double your limit). Getting this math automatic is one of the highest-leverage skills in trading."
  },
  {
    situation: "You're in a profitable long trade. The stock just printed a shooting star candle at a major resistance level with volume spiking on the candle.",
    options: ["A. Hold — one candle doesn't change the trend", "B. Take partial profits or tighten your stop — the shooting star is a strong reversal warning", "C. Add to the position — volume confirms the move", "D. Set a hard stop at breakeven and ignore the signal"],
    answer: 1,
    explanation: "A shooting star at resistance with volume is one of the most reliable reversal signals in candlestick analysis. The long upper wick shows buyers pushed up but sellers overwhelmed them. Taking partial profits respects the signal while keeping exposure if you're wrong. Ignoring it because 'one candle doesn't matter' is how you give back winners."
  },
  {
    situation: "You enter a long at $50. The stock quickly drops to $49.40, triggering your stop. You're out at $49.40 with a $60 loss on 100 shares. Two hours later the stock is at $53. How do you feel?",
    options: ["A. Angry — you should have held through the stop", "B. Neutral — your stop was correct, the outcome doesn't change the decision quality", "C. Relieved — the stop saved you from a bigger loss initially", "D. Motivated to never use stops again so you can hold through dips"],
    answer: 1,
    explanation: "This is the most important mindset test in trading. A stopped-out trade that 'would have worked' feels like a mistake but it wasn't. You made the right decision with the information available at entry. You cannot judge trade decisions by outcomes — only by process. The stop was placed correctly. The fact it bounced is irrelevant to whether the stop was right. Outcome bias is what makes traders abandon good systems."
  },
  {
    situation: "Your account is up 18% this month — your best ever. With one week left in the month, you want to push for 25%.",
    options: ["A. Increase size to reach 25% — you're clearly in a hot streak", "B. Protect the 18% — reduce size for the final week and lock in the month", "C. Trade the same as always — no adjustment needed", "D. Only take the very best setups at normal size"],
    answer: 3,
    explanation: "Option D is the disciplined approach that doesn't chase but also doesn't quit. Your edge is working — keep running it at normal size with your normal criteria. Option B (protect the month) is also valid psychology for developing traders. Option A is the trap: increasing size after a hot streak means when the inevitable losing trade hits, it hits bigger. The 18% is real — don't give it back to ego."
  },
  {
    situation: "A momentum stock runs up 40% in 3 days. On day 4 it gaps up another 8% at open. This is the parabolic phase. You want to buy.",
    options: ["A. Buy — parabolic stocks keep going parabolic", "B. Avoid the long — parabolic 4th-day moves have very high reversal risk", "C. Short it immediately — it's definitely topping", "D. Buy half size with a very tight stop"],
    answer: 1,
    explanation: "The 4th or 5th day of a parabolic move is where retail FOMO peaks and smart money sells. Volume is often climactic — massive, then suddenly dry. The risk/reward of buying day 4 of a parabolic is poor: you're entering where professional traders are exiting. If you want to trade it, wait for the reversal and short the first red candle after the exhaustion — don't chase the last leg up."
  },
  {
    situation: "You're watching a stock that keeps bouncing between $20 support and $25 resistance for 6 weeks. It's currently at $20.10.",
    options: ["A. Buy now — it's at support and will bounce to $25 again", "B. Wait for a confirmed bounce candle before entering long", "C. Short it — range-bound stocks eventually break down", "D. The range is too tight to trade profitably"],
    answer: 1,
    explanation: "Support in a range is real but not guaranteed. The stock has respected it 6 times — but this touch could be the breakdown. Waiting for a confirmed bullish candle (hammer, engulfing, doji reversal) before entering gives confirmation that buyers are stepping in again. Buying at the first touch of support without confirmation means you might catch a knife if the range breaks down."
  },
  {
    situation: "You missed your entry on a setup. The stock ran 3% without you. You're now watching it consolidate just below resistance. Do you enter?",
    options: ["A. Yes — it's pausing before the next leg up", "B. No — you missed the entry. Wait for a new setup to form", "C. Enter half size since you missed the ideal entry", "D. Enter if volume picks up during the consolidation"],
    answer: 1,
    explanation: "Chasing a missed entry is one of the most common errors. Your original entry criteria existed for a reason — the setup met your rules at that price. Now the stock has moved 3%, your risk/reward is completely different, and you're entering from a position of FOMO rather than analysis. The best response to a missed entry is: mark it in your journal, move on, and find the next setup."
  },
  {
    situation: "It's earnings season. Every morning there are 5–10 high-volume, news-driven stocks moving 15%+. You feel like you should be trading them all.",
    options: ["A. Trade as many as possible — earnings season is the best time of year", "B. Pick 1–2 that fit your strategy best and ignore the rest", "C. Avoid trading during earnings season entirely", "D. Trade all of them with smaller size to diversify"],
    answer: 1,
    explanation: "Earnings season creates noise disguised as opportunity. Chasing multiple earnings movers simultaneously splits your focus, increases your error rate, and leads to overtrading. Professional traders identify 1–2 setups that match their specific strategy and execute those well. FOMO about all the other moves is what causes undisciplined trades. More opportunities doesn't mean more profit — it usually means more mistakes."
  },
  {
    situation: "You're watching a falling wedge form over 2 weeks on a stock that's been in a downtrend. The wedge is tightening. Volume has declined throughout.",
    options: ["A. Short it — the downtrend continues inside the wedge", "B. Watch for a breakout above the upper trendline — falling wedges are bullish reversal patterns", "C. Buy immediately — the wedge is almost complete", "D. Ignore it — wedge patterns are unreliable"],
    answer: 1,
    explanation: "A falling wedge is a bullish continuation or reversal pattern. Declining volume during the wedge formation is confirmation — sellers are losing conviction. The trigger is a breakout above the upper descending trendline on increased volume. Shorting into a falling wedge trades against the pattern's directional bias. Buying before the breakout means you're guessing — wait for the trigger."
  },
  {
    situation: "Your broker sends a warning: you've made 3 day trades this week in a margin account under $25,000. One more and you'll be flagged as a Pattern Day Trader.",
    options: ["A. Take the 4th trade — PDT designation doesn't actually restrict anything", "B. Stop day trading for the rest of the week to avoid the PDT flag", "C. Immediately deposit $25,000 to avoid the restriction", "D. Close your margin account and open a cash account"],
    answer: 1,
    explanation: "PDT designation restricts your account to 3 round-trip day trades per 5 business days until you have $25,000. Once flagged, you must either deposit $25k or wait out the restriction. Stopping day trades for the week is the practical short-term move. Long-term: a cash account has no PDT restriction (funds just need to settle T+1 for options, T+2 for stocks), which is often better for smaller accounts."
  },
  {
    situation: "You've been tracking a stock for 2 weeks building a thesis. You enter. 5 minutes later your friend texts you a news article saying the stock is in trouble. What do you do?",
    options: ["A. Immediately sell — your friend's article changes everything", "B. Evaluate the article's source and relevance before making any decision", "C. Hold — you did your own research and trust your thesis", "D. Sell half to hedge the uncertainty"],
    answer: 1,
    explanation: "Knee-jerk reactions to unverified news is how traders get whipsawed. First: what's the source? Is it credible? Is it new information or old news being recirculated? Does it materially change your thesis? A clickbait article is different from an SEC filing. Evaluate first, react second. That said — if the article contains genuinely new material negative information you didn't know, that changes the picture and exiting is valid."
  },
  {
    situation: "You've had your best month ever — up $4,200. Your partner asks where the money came from. They're worried about you 'gambling.' How do you respond to yourself?",
    options: ["A. They're wrong — trading is a skill, not gambling", "B. Honestly assess: are you following a repeatable process with defined risk, or are you getting lucky?", "C. Show them your P&L to prove it's working", "D. Keep it to yourself — they don't understand trading"],
    answer: 1,
    explanation: "One good month doesn't prove a system. The most important question is whether you can articulate exactly why each trade was taken and whether you followed your rules. If you can't, your partner might be more right than you want to admit. The distinction between trading and gambling is process: defined entry criteria, defined risk, defined exit. A great month built on luck will reverse. A great month built on process is a foundation."
  },
  {
    situation: "A stock you want to short has a high short borrow rate (15% annualized). You plan to hold the short for 2 weeks.",
    options: ["A. The borrow rate doesn't matter for a 2-week trade", "B. Factor the borrow cost into your expected profit — it eats into your return", "C. Avoid all trades with borrow fees", "D. The borrow fee only applies if you lose the trade"],
    answer: 1,
    explanation: "Short borrow fees are charged daily on the value of shares you've borrowed. At 15% annually, a 2-week hold costs roughly 0.58% of the position value in fees alone. On a $10,000 short, that's $58 you need to earn just to break even on the fee. Always factor borrow costs into your target price. High borrow rates also signal heavy short interest, which increases squeeze risk."
  },
  {
    situation: "You see two identical setups: one on a $5 stock, one on a $500 stock. Both have the same percentage stop (1%). Which do you trade?",
    options: ["A. The $5 stock — it's cheaper per share", "B. Either can be traded — with proper position sizing, the dollar risk is the same", "C. The $500 stock — more expensive stocks are more reliable", "D. Neither — the setups need to be evaluated on more than price"],
    answer: 1,
    explanation: "Price per share is irrelevant when you size by risk. A 1% stop on a $5 stock = $0.05/share. A 1% stop on a $500 stock = $5/share. With a $100 risk budget: $0.05 stop = 2,000 shares; $5 stop = 20 shares. Both risk exactly $100. The decision should be based on the quality of the setup, liquidity, and your execution comfort — not the nominal share price."
  },
  {
    situation: "It's been 3 weeks since you had a winning trade. You're down $800 overall. You're starting to question everything.",
    options: ["A. Quit trading — 3 bad weeks proves it doesn't work for you", "B. Step back, audit your last 20 trades for rule violations, then decide", "C. Double your size to recover faster", "D. Switch to a completely different strategy immediately"],
    answer: 1,
    explanation: "Three losing weeks is painful but not automatically a sign the strategy is broken. Before any decision, audit your last 20 trades: Did you follow your rules? Were there clear external conditions (high VIX, no trend, earnings season)? What's your actual win rate vs. your expected win rate? Data tells you whether to persist, adjust, or pause. Emotional reactions — quitting, doubling size, or wholesale strategy changes — rarely fix the actual problem."
  },
  {
    situation: "You buy a stock that then drops 8% in one session. Your original stop was at -3%. You held through the stop because you 'knew' it would bounce.",
    options: ["A. Holding was correct since it may still bounce", "B. You made a critical error — overriding your stop is the behavior that blows accounts", "C. The stop was too tight — your analysis about the bounce was right", "D. This only matters if you end up losing money on the trade"],
    answer: 1,
    explanation: "Overriding your stop is the single most account-destroying behavior in trading. The stop was placed when you had clear thinking and a defined maximum loss. Holding through it — especially because you 'knew' it would bounce — is the definition of hope over process. The fact it might still work out is irrelevant. If you override your stop once, you'll do it again. One bad override can wipe months of gains."
  },
  {
    situation: "You want to trade NVDA but the chart looks extended on the daily. On the 5-minute chart there's a perfect bull flag setup. What should you do?",
    options: ["A. Take the 5-min bull flag — the setup is clear", "B. Check if the daily context supports the 5-min direction before entering", "C. Only trade daily charts — intraday is too noisy", "D. The 5-min is the only chart that matters for day trading"],
    answer: 1,
    explanation: "Multi-timeframe alignment dramatically increases setup quality. A bull flag on the 5-min has much better follow-through if the daily chart is also in an uptrend or consolidating, not extended and overbought. Trading a 5-min long setup into daily resistance is fighting two timeframes. The daily gives context; the 5-min gives entry. Both should agree."
  },
  {
    situation: "You're consistently profitable but your biggest wins are small and your biggest losses are large — you're running a negative skew. Your overall P&L is still positive but barely.",
    options: ["A. Keep going — positive P&L is all that matters", "B. Fix the skew: cut losses faster and let winners run longer — your edge exists but you're undermining it", "C. Increase trade frequency to average out the skew", "D. The skew doesn't matter as long as win rate is above 50%"],
    answer: 1,
    explanation: "Negative skew — small wins, large losses — is unsustainable even with positive P&L. One or two large losses can wipe a month of small wins. The fix is behavioral: honor stops precisely and use trailing stops on winners instead of exiting at the first profit. Your edge exists (you have a positive P&L) but you're systematically leaving it on the table. Fixing the skew turns a marginal system into a robust one."
  },
  {
    situation: "You want to buy AAPL but it reports earnings in 3 days. The setup is technically perfect. Should you enter now or wait?",
    options: ["A. Enter now — the setup is perfect and three days is plenty of time", "B. Wait for post-earnings if you want a clean directional trade", "C. Buy now with a stop very close to entry to limit earnings risk", "D. Buy half now and add after earnings"],
    answer: 1,
    explanation: "Entering a clean technical setup 3 days before earnings means you're taking on binary event risk regardless of how good the chart looks. Earnings can gap the stock 10% in either direction overnight, bypassing any stop. Either wait for the post-earnings reaction (which often creates better setups anyway) or treat it as a very short-term trade with the intention to close before earnings. Never unknowingly hold through earnings."
  },
  {
    situation: "You're in a trade. Your profit is $200. You've been holding for 2 hours and the stock hasn't moved in 45 minutes. Your original target was $400.",
    options: ["A. Hold until the target — you planned $400", "B. Consider exiting or tightening your stop — a stalled trade in profit is better closed than reversed", "C. Add to the position to force it to your target", "D. Lower your target to $200 since that's what it wants to give you"],
    answer: 1,
    explanation: "A stalled trade with open profit is a risk management decision, not a patience test. Two hours holding for a target that's 45 minutes of stuck price away means your thesis isn't playing out on schedule. Tightening your stop to lock in $150-180 of the $200 gains lets the trade breathe while guaranteeing you keep most of the profit. Holding rigidly to an original target when price is stalling often means giving back gains."
  },
  {
    situation: "A veteran trader you respect says 'never short a stock under $5.' You see a perfect technical short setup on a $3 stock.",
    options: ["A. Short it — the setup is the setup, price doesn't matter", "B. Respect the rule — sub-$5 stocks are manipulated and unpredictable for shorting", "C. Half size to compromise between the rule and the setup", "D. Ask the veteran why before deciding"],
    answer: 1,
    explanation: "Rules from experienced traders usually exist because of painful lessons. Sub-$5 stocks are often harder to borrow, have wide spreads, low liquidity, can be halted by exchanges more easily, and are frequent targets of pump-and-dump manipulation. A short squeeze on a $3 stock with tiny float can be catastrophic. Respecting risk-based rules even when you think you have the right setup is part of longevity. Test the rule on paper first."
  },
  {
    situation: "You're watching a stock that has been rejected at $100 three times. It's approaching $100 again. Your momentum indicator is flashing bullish.",
    options: ["A. Buy — the bullish indicator means it'll break through this time", "B. Wait for a confirmed close above $100 before taking a long position", "C. Short at $100 — triple rejection means it'll fail again", "D. The indicator outweighs the price resistance"],
    answer: 1,
    explanation: "Triple rejection at a level means $100 is significant resistance. A bullish momentum indicator approaching that level doesn't guarantee a breakout — it means buyers are attempting it. The clean trade is waiting for a confirmed close above $100 (ideally with volume). That's your evidence the resistance has flipped to support. Buying before the break means you may be holding through another rejection."
  },
  {
    situation: "You've been paper trading for 4 months with strong results. You go live with $2,000. On your 3rd live trade you make a significant error — you bought 10x too many shares by mistake.",
    options: ["A. Hold — maybe it'll work out anyway", "B. Immediately close the entire position regardless of P&L — a sizing error is never a trade", "C. Sell enough shares to get back to your intended position size", "D. Hold half and sell half"],
    answer: 1,
    explanation: "A position entered by mistake is not a trade — it's an error. Close it immediately and completely, regardless of whether it's currently profitable. Option C sounds logical, but you're now making trading decisions based on an error, not a setup. The reason to close everything: you have no thesis for that position size, no planned stop at that size, and no defined exit. Treat errors as errors, not opportunities."
  },
  {
    situation: "It's 9:28 AM. You have 2 minutes before the open. You see a perfect setup forming. You rush to enter before the bell rings.",
    options: ["A. Enter now — getting in early gives you a better price", "B. Wait for the open — pre-open orders can get filled at unpredictable prices", "C. Set a limit order to trigger exactly at 9:30:00", "D. Skip it — setups that form before open are unreliable"],
    answer: 1,
    explanation: "Entering a stock position in the last 2 minutes before the bell is risky — liquidity is thin, spreads are wide, and your order may fill at a price far from where you expect. At the open, order flow normalizes within seconds and you get better execution. Waiting 30 seconds for the market to open is almost always the better choice over a chaotic pre-open fill."
  },
  {
    situation: "You've been watching a stock consolidate tightly for 5 days. Today it breaks out on 4x average volume. You're not in the trade. What do you do?",
    options: ["A. Chase it immediately — volume confirms the breakout", "B. Add it to your watchlist and wait for a pullback to the breakout level", "C. It's too late — breakouts that you miss should always be ignored", "D. Buy in after market close when it's calmer"],
    answer: 1,
    explanation: "Missing the initial breakout doesn't mean the trade is over. The textbook move after a volume breakout is for price to pull back and retest the breakout level, which now becomes support. That pullback is often the cleanest, lowest-risk entry. Adding to your watchlist and waiting for the retest puts you in the trade with a defined stop (below the breakout level) rather than chasing into a spike."
  },
  {
    situation: "Your trading account has grown from $5,000 to $12,000 over 6 months. Should you increase your position sizes?",
    options: ["A. Yes — proportionally scale size to account size immediately", "B. Scale size gradually as you confirm your consistency holds at the new level", "C. Keep the exact same dollar amount per trade forever", "D. Double your size immediately to accelerate growth"],
    answer: 1,
    explanation: "Scaling is correct — but gradually and with confirmation. When your account grows, your 1% risk dollar amount grows too. The risk is that traders scale too fast after a hot streak and give back gains when the inevitable drawdown comes. The right approach: increase size in small increments (10-20%), trade that size for 2-3 weeks, confirm your win rate and process hold, then increment again. Never jump from $100/trade to $500/trade overnight."
  },
  {
    situation: "You're analyzing a chart. The stock is above its 20 EMA, above VWAP, and RSI is 58. Volume is average. There's no news. Is there a trade?",
    options: ["A. Yes — all indicators are bullish, buy immediately", "B. Not necessarily — indicators confirm trend but you still need a specific trigger and defined risk", "C. No — RSI under 70 means it hasn't confirmed strength", "D. Yes — VWAP above is all you need"],
    answer: 1,
    explanation: "Indicators being 'bullish' is context, not a trade signal. You still need a specific entry trigger: a breakout, a pullback to a level, a candlestick reversal. Without a trigger, you're buying into randomness with no defined stop. 'Everything looks good' is not an entry criterion. Define exactly what price action would trigger your entry and where your stop would be — if you can't, there's no trade yet."
  },
  {
    situation: "You take a trade. It immediately moves in your favor by $150. You feel great. Then it gives back $80 and you're now up $70. You feel worse than when you were flat.",
    options: ["A. Exit immediately — you can't handle the emotional swings", "B. This is normal loss aversion — manage the trade with your original plan, not the ghost of the $150", "C. Set your stop to lock in the $70 immediately", "D. Add to the position since the dip is a buying opportunity"],
    answer: 1,
    explanation: "What you experienced is loss aversion applied to unrealized gains — the $80 drawdown from $150 felt like a loss even though you're still up $70. This is one of the most destructive cognitive biases in trading. Your decision should be based on your original plan: is price still above your stop? Is the setup still valid? Not on how it felt to go from $150 to $70. The ghost of the peak gain is not your benchmark."
  },
  {
    situation: "A stock in your watchlist just broke out. You're at the gym and see it on your phone. You can't monitor it properly. Do you enter?",
    options: ["A. Enter — you'll monitor from your phone", "B. Skip it — trading requires full attention; entering a trade you can't manage is reckless", "C. Enter with a wider stop so you don't need to watch it closely", "D. Enter half size since you're distracted"],
    answer: 1,
    explanation: "Active day trading requires full attention. You need to be able to react within seconds to news, price action, or technical changes. Trading from a phone at the gym while distracted is how small losses become large ones — you can't manage the position. Skip the trade. There will always be another setup when you're properly set up to trade. The cost of missing one trade is far less than the cost of a poorly managed one."
  },
  {
    situation: "You bought a stock based on a tip from a trading Discord. It immediately went up 5% and you're in profit. The tipster now says 'take profits.' What do you do?",
    options: ["A. Follow the tipster's exit since you followed their entry", "B. Evaluate the exit based on your own technical analysis, not the tipster's instruction", "C. Hold — you don't exit profitable trades on other people's advice", "D. Exit only half since you're uncertain"],
    answer: 1,
    explanation: "If you entered without your own analysis, you can't manage the trade intelligently. You have no thesis, no technical level to hold, and no stop logic of your own. In this case, taking the profit and exiting when the tipster says so is actually the pragmatic choice — but the lesson is: never enter a trade you can't manage independently. You're the one risking real money. You need to own every entry and exit decision."
  },
  {
    situation: "It's November and the market has been in a strong uptrend all year. You've been mostly long and profitable. December approaches and you hear about 'tax-loss harvesting season.'",
    options: ["A. Ignore it — seasonal patterns don't affect individual stocks", "B. Be aware: institutions sell losers in December for tax reasons, which can pressure weak stocks", "C. Sell everything in November to avoid the December selling", "D. Buy everything aggressively in December since prices drop"],
    answer: 1,
    explanation: "Tax-loss harvesting is real and affects market microstructure in November-December. Institutions sell their biggest losing positions to realize losses before year-end. This creates selling pressure on already-weak stocks. Being aware doesn't mean you change everything — it means you're more cautious holding beaten-down names near year-end and you understand why certain stocks may see unusual selling. Then in January, many of these names bounce back (the January effect)."
  },
  {
    situation: "You've built a trading strategy that works in trending markets. You've been running it for 3 months with good results. Suddenly the market enters a choppy, range-bound environment and your strategy stops working.",
    options: ["A. Keep trading it — the trend will return", "B. Recognize that market conditions changed — reduce size or pause the strategy until trending conditions return", "C. Abandon the strategy entirely and find a new one", "D. Increase size to force the strategy to work"],
    answer: 1,
    explanation: "All strategies have regime dependence — they work in certain market conditions and fail in others. A trend-following strategy in a choppy market will generate losses consistently. This isn't strategy failure; it's condition mismatch. The correct response is to reduce size dramatically or pause until trending conditions return, not to force it or abandon it entirely. Learning to identify your strategy's optimal market condition is an advanced but crucial skill."
  },
  {
    situation: "You find a backtested strategy online with a claimed 80% win rate over 1,000 trades. The developer is selling it for $299.",
    options: ["A. Buy it — 80% win rate on 1,000 trades is statistically significant", "B. Be skeptical — backtested results suffer from overfitting and don't account for real execution", "C. Buy it and test it on paper for 1 week before going live", "D. Only buy it if the developer shows audited live trading results"],
    answer: 3,
    explanation: "Backtested results are almost always optimistic. Overfitting (tuning the strategy to past data), survivorship bias, and ignoring execution costs (spread, slippage, commissions) inflate backtested win rates. The only meaningful proof is live audited results over a significant period. Even then, you need to verify those results are real. Paying $299 for a backtested strategy is paying for someone's hindsight. Learn the principles instead."
  },
  {
    situation: "You've been trading the same stock (TSLA) every day for 3 months. You feel like you 'know' it better than any other stock. A setup forms on NVDA that looks cleaner. What do you do?",
    options: ["A. Take the NVDA setup — a better setup is a better setup regardless of stock", "B. Stick to TSLA — familiarity with one stock is a real edge and shouldn't be abandoned casually", "C. Trade both — diversification in setups is good", "D. Paper trade NVDA for a week before going live on it"],
    answer: 1,
    explanation: "Stock familiarity is genuinely valuable — knowing a stock's average daily range, how it reacts to market moves, its tendency to spike or grind, its typical spread. This is real edge. Abandoning that to chase a 'cleaner' setup on an unfamiliar stock introduces unknown variables. The better approach: stick to TSLA unless you've spent time studying NVDA's behavior specifically. Edge built on familiarity compounds over time."
  }
];

let _scDeck = [];
let _scIdx = 0;
let _scScore = 0;
let _scAnswered = false;

function scBuildDeck() {
  _scDeck = SCENARIOS.slice();
  // shuffle
  for (let i = _scDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [_scDeck[i], _scDeck[j]] = [_scDeck[j], _scDeck[i]];
  }
  _scIdx = 0;
  _scScore = 0;
  _scAnswered = false;
  document.getElementById('sc-results').style.display = 'none';
  document.getElementById('sc-area').style.display = '';
  scRenderScenario();
}

function scRenderScenario() {
  if (_scIdx >= _scDeck.length) { scShowResults(); return; }
  const sc = _scDeck[_scIdx];
  _scAnswered = false;
  document.getElementById('sc-situation').textContent = sc.situation;
  document.getElementById('sc-progress-text').textContent = `Scenario ${_scIdx + 1} of ${_scDeck.length}`;
  document.getElementById('sc-progress-bar').style.width = (_scIdx / _scDeck.length * 100) + '%';
  const optsEl = document.getElementById('sc-options');
  optsEl.innerHTML = sc.options.map((o, i) => `
    <button class="sc-opt" onclick="scChoose(${i})">${o}</button>`).join('');
  document.getElementById('sc-explanation').style.display = 'none';
  document.getElementById('sc-next-row').style.display = 'none';
}

function scChoose(idx) {
  if (_scAnswered) return;
  _scAnswered = true;
  const sc = _scDeck[_scIdx];
  const btns = document.querySelectorAll('.sc-opt');
  btns.forEach((b, i) => {
    b.classList.add('disabled');
    if (i === sc.answer) b.classList.add('correct');
    else if (i === idx && idx !== sc.answer) b.classList.add('wrong');
  });
  if (idx === sc.answer) _scScore++;
  const expEl = document.getElementById('sc-explanation');
  expEl.textContent = sc.explanation;
  expEl.style.display = '';
  document.getElementById('sc-next-row').style.display = '';
}

function scNext() {
  _scIdx++;
  scRenderScenario();
}

function scShowResults() {
  document.getElementById('sc-area').style.display = 'none';
  document.getElementById('sc-results').style.display = '';
  const pct = Math.round((_scScore / _scDeck.length) * 100);
  document.getElementById('sc-results-score').textContent = `${_scScore} / ${_scDeck.length} correct (${pct}%)`;
  document.getElementById('sc-progress-bar').style.width = '100%';
  document.getElementById('sc-progress-text').textContent = `Done! ${_scScore}/${_scDeck.length}`;
}

function scRestart() {
  scBuildDeck();
}

function scShuffle() {
  scBuildDeck();
  const area = document.getElementById('sc-area');
  if (area) { area.classList.add('shuffle-pulse'); setTimeout(() => area.classList.remove('shuffle-pulse'), 400); }
}

// Init scenarios
scBuildDeck();

// ==================== MY LIBRARY ====================

const LIB_BOOKS = [
  { title: "How to Day Trade for a Living", author: "Andrew Aziz", format: "EPUB", path: "How to Day Trade for a Living by Andrew Aziz EPUB/How to Day Trade for a Living by Andrew Aziz.epub" },
  { title: "How to Day Trade for a Living", author: "Andrew Aziz (alt)", format: "EPUB", path: "How to Day Trade for a Living/how to day trade for a living tools, tactics, mone.epub" },
  { title: "How to Day Trade Penny Stocks", author: "Bill Sykes", format: "EPUB", path: "How to Day Trade Penny Stocks for Beginners by Bill Sykes EPUB/How to Day Trade Penny Stocks for Beginners by Bill Sykes.epub" },
  { title: "High-Probability Trade Setups", author: "Chartist's Guide", format: "PDF", path: "High-Probability Trade Setups - A Chartist's Guide to Real-Time Trading/~Get Your Files Here !/High-ProbabilityTradeSetups.pdf" },
  { title: "How To Swing Trade", author: "Beginner's Guide", format: "PDF", path: "How To Swing Trade - A Beginners Guide to Trading Tools, Money Management, Rules, Routines and Strategies/How To Swing Trade - A Beginners Guide to Trading Tools, Money Management, Rules, Routines and Strategies.pdf" },
  { title: "Strategies for Profiting on Every Trade", author: "Oliver L. Velez", format: "PDF", path: "Strategies for Profiting on Every Trade_ Simple Lessons for Mastering the Market by Oliver L. Velez .. PDF/Strategies for Profiting on Every Trade_ Simple Lessons for Mastering the Market by Oliver L. Velez ...pdf" },
  { title: "Trade Like Jesse Livermore", author: "Richard Smitten", format: "PDF", path: "Trade Like Jesse Livermore by Richard Smitten PDF/Trade Like Jesse Livermore by Richard Smitten.pdf" },
  { title: "Trade Like a Pro", author: "Jode Lebin", format: "PDF", path: "TRADE LIKE PRO by Jode Lebin (PDF)(Nonfiction).pdf" },
  { title: "CRYPTOTRADING PRO", author: "", format: "PDF", path: "CRYPTOTRADING PRO/Book/CRYPTOTRADING PRO.pdf" },
];

const LIB_COURSES = [
  {
    title: "Trade One Pattern, Master One Process",
    root: "Trade One Pattern, Master One Process/~Get Your Files Here !",
    sections: [
      { title: "Why Most Traders Never Make It", videos: [
        "1 - Why Most Traders Never Make It/1 -Introduction.mp4",
        "1 - Why Most Traders Never Make It/2 -The Real Problem No Process, No Profits.mp4",
        "1 - Why Most Traders Never Make It/3 -The Setup That Changed Everything.mp4",
        "1 - Why Most Traders Never Make It/4 -Examples of The Setup.mp4",
        "1 - Why Most Traders Never Make It/5 -The Discipline Framework.mp4",
      ]},
      { title: "The Setup – Wedge, Break, Execute", videos: [
        "2 - The Setup – Wedge, Break, Execute/1 -Spotting the Wedge.mp4",
        "2 - The Setup – Wedge, Break, Execute/2 -Timing the Break.mp4",
        "2 - The Setup – Wedge, Break, Execute/3 -Executing with Precision.mp4",
        "2 - The Setup – Wedge, Break, Execute/4 -Contraction explanations (XAUUSD Real example).mp4",
      ]},
      { title: "Turn This into Income – Routine, Rules, Results", videos: [
        "3 - Turn This into Income – Routine, Rules, Results/1 -One Trade a Day Small Account Blueprint.mp4",
        "3 - Turn This into Income – Routine, Rules, Results/2 -Asset Focus Pick One, Master It.mp4",
        "3 - Turn This into Income – Routine, Rules, Results/3 -Your Trading Commandments.mp4",
        "3 - Turn This into Income – Routine, Rules, Results/4 -Final Words Boring Wins.mp4",
      ]},
    ]
  },
  {
    title: "TradingView + Technical Analysis: The Trading Blueprint",
    root: "Tradingview + Technical Analysis - The Trading Blueprint/~Get Your Files Here !",
    sections: [
      { title: "Introduction And Welcome", videos: [
        "1 - Introduction And Welcome/1 - My Introduction.mp4",
        "1 - Introduction And Welcome/2 - What this course covers.mp4",
        "1 - Introduction And Welcome/3 - What you will achieve in this course.mp4",
        "1 - Introduction And Welcome/4 - How to get the most out of this course.mp4",
        "1 - Introduction And Welcome/5 - What do you need for this course.mp4",
        "1 - Introduction And Welcome/6 - Lets Begin The Journey.mp4",
      ]},
      { title: "Getting Started With TradingView", videos: [
        "2 - Getting Started With Trading View/7 - Getting started with trading view.mp4",
        "2 - Getting Started With Trading View/8 - Sign In and Overview.mp4",
        "2 - Getting Started With Trading View/9 - 4 Major Sections of the Trading View.mp4",
      ]},
      { title: "Top Section", videos: [
        "3 - Top Section/10 - Select Different Coins.mp4",
        "3 - Top Section/11 - Compare Symbols.mp4",
        "3 - Top Section/12 - Time Frame.mp4",
        "3 - Top Section/13 - Candles.mp4",
        "3 - Top Section/14 - Indicators.mp4",
        "3 - Top Section/15 - Alerts.mp4",
        "3 - Top Section/16 - Replay.mp4",
        "3 - Top Section/17 - Undo Redo.mp4",
        "3 - Top Section/18 - Chart Layout.mp4",
        "3 - Top Section/19 - Saving A Chart.mp4",
        "3 - Top Section/20 - Quick Search.mp4",
        "3 - Top Section/21 - Chart Settings.mp4",
        "3 - Top Section/22 - Publish tool.mp4",
      ]},
      { title: "Left Section", videos: [
        "4 - Left Section/23 - Pointer.mp4",
        "4 - Left Section/24 - Trendlines.mp4",
        "4 - Left Section/25 - Fibonacci Tool.mp4",
        "4 - Left Section/26 - Patterns.mp4",
        "4 - Left Section/27 - Projection.mp4",
        "4 - Left Section/28 - Brushes.mp4",
        "4 - Left Section/29 - Text And Emojis.mp4",
        "4 - Left Section/30 - Measure Tool.mp4",
        "4 - Left Section/31 - Zoom In And Zoom Out.mp4",
        "4 - Left Section/32 - Magnet Tool.mp4",
        "4 - Left Section/33 - Lock Hide And Delete Drawings.mp4",
        "4 - Left Section/34 - Basic Technical Analysis For you to start trading.mp4",
      ]},
      { title: "Right Section", videos: [
        "5 - Right Section/35 - Watchlists News.mp4",
        "5 - Right Section/36 - Alerts.mp4",
        "5 - Right Section/37 - Object Tree And Data Window.mp4",
        "5 - Right Section/38 - Messages.mp4",
        "5 - Right Section/39 - Screeners.mp4",
        "5 - Right Section/40 - Market News.mp4",
        "5 - Right Section/41 - End Of Right Section.mp4",
      ]},
      { title: "Bottom Section", videos: [
        "6 - Bottom Section/42 - Bottom Section.mp4",
      ]},
      { title: "Psychology & Learning", videos: [
        "7 - Read Learn and fix your sentiments and the psychology/43 - How to fix your psychology and learn faster.mp4",
      ]},
      { title: "Basic Technical Analysis", videos: [
        "8 - Basic Technical Analysis for Trading/44 - Technical Analysis Liquidity Areas Demand And Supply zones.mp4",
      ]},
    ]
  },
  {
    title: "TradingView Mobile: The Complete Trader's Guide",
    root: "[ FreeCourseWeb.com ] Udemy - TradingView Mobile - The Complete Trader's Guide/~Get Your Files Here !",
    sections: [
      { title: "Introduction To TradingView On Mobile", videos: [
        "1 - Introduction To TradingView On Mobile/1 -Introduction.mp4",
        "1 - Introduction To TradingView On Mobile/2 -Why TradingView is a Must have Tool for Traders.mp4",
        "1 - Introduction To TradingView On Mobile/3 -Downloading and Installing TradingView App (IOS & Android).mp4",
        "1 - Introduction To TradingView On Mobile/4 -Creating and Setting up your TradingView Account.mp4",
      ]},
      { title: "Mastering The Basics", videos: [
        "2 - Mastering The Basics Of TradingView Mobile/1 -Overview of the home screen, watchlist and charting tools.mp4",
        "2 - Mastering The Basics Of TradingView Mobile/2 -Customizing your workspace for optimal trading.mp4",
        "2 - Mastering The Basics Of TradingView Mobile/3 -How to Add Forex pairs, Stocks and Cryptocurrencies.mp4",
        "2 - Mastering The Basics Of TradingView Mobile/4 -Exploring the line chart, bar chart and candlesticks.mp4",
        "2 - Mastering The Basics Of TradingView Mobile/5 -Switching between Timeframes (1-minute to Monthly).mp4",
      ]},
      { title: "Advanced Charting Tools On Mobile", videos: [
        "3 - Advanced Charting Tools On Mobile/1 -Using Drawing Tools, Trendlines, Support and Resistance & Fibonacci Retracements.mp4",
        "3 - Advanced Charting Tools On Mobile/2 -Adding and Customizing Indicators (RSI, MACD, Moving Averages.mp4",
        "3 - Advanced Charting Tools On Mobile/3 -Setting Up Price Alerts.mp4",
      ]},
      { title: "Trading and Analysis On Mobile", videos: [
        "4 - Trading and Analysis On TradingView Mobile/1 -Using TradingView Social features to follow other trader's ideas.mp4",
        "4 - Trading and Analysis On TradingView Mobile/2 -Connecting Your Broker To Tradingview.mp4",
        "4 - Trading and Analysis On TradingView Mobile/3 -Placing Trades Directly from the App.mp4",
        "4 - Trading and Analysis On TradingView Mobile/4 -Using Tradingview Replay Tool to Test Strategies.mp4",
      ]},
      { title: "Tips, Tricks And Best Practices", videos: [
        "5 - Tips, Tricks And Best Practices/1 -Customizing Themes and Creating & Saving Layouts.mp4",
      ]},
    ]
  },
  {
    title: "Trade Like a Hedge Fund Manager",
    root: "[ FreeCourseWeb.com ] Udemy - Trade like a Hedge Fund manager - Long - Short Equity strategy/~Get Your Files Here !",
    sections: [
      { title: "Full Course", videos: [
        "1. Full free course/1. Introduction to the LongShort Equity approach.mp4",
        "1. Full free course/2. Lessons from Julian Robertson and the Tiger cubs.mp4",
      ]},
      { title: "Additional Resources", videos: [
        "2. Additional resources/1. Julian Robertson interview.mp4",
        "2. Additional resources/2. Philippe Laffont interview - CEO and Founder of Coatue Management - Part 1.mp4",
        "2. Additional resources/3. Philippe Laffont interview - CEO and Founder of Coatue Management - Part 2.mp4",
      ]},
    ]
  },
  {
    title: "Confirmed Divergence: Swing Trade & Day Trading Strategy",
    root: "[ FreeCryptoLearn.com ] Udemy - Confirmed Divergence - Swing Trade and Day Trading Strategy/~Get Your Files Here !",
    sections: [
      { title: "Introduction", videos: [
        "01 - Introduction/001 Introduction.mp4",
        "01 - Introduction/002 Divergence in a Nutshell.mp4",
      ]},
      { title: "Confirmed Divergence Setup", videos: [
        "02 - Confirmed Divergence Setup/001 The Setup.mp4",
        "02 - Confirmed Divergence Setup/002 Identifying Confirmed Divergence Setup.mp4",
        "02 - Confirmed Divergence Setup/003 Entry.mp4",
        "02 - Confirmed Divergence Setup/004 Stop Loss.mp4",
        "02 - Confirmed Divergence Setup/005 Profit Target.mp4",
        "02 - Confirmed Divergence Setup/006 Trade Management.mp4",
        "02 - Confirmed Divergence Setup/007 Reminders.mp4",
      ]},
      { title: "Weekly & 4-Hour Setups", videos: [
        "03 - Weekly and 4-Hour Confirmed Divergence Setup/001 AUDUSD Long.mp4",
        "03 - Weekly and 4-Hour Confirmed Divergence Setup/002 Bitcoin Long.mp4",
        "03 - Weekly and 4-Hour Confirmed Divergence Setup/003 Bitcoin Short.mp4",
        "03 - Weekly and 4-Hour Confirmed Divergence Setup/004 EURUSD Short.mp4",
        "03 - Weekly and 4-Hour Confirmed Divergence Setup/005 XRP Short.mp4",
      ]},
      { title: "Daily & 1-Hour Setups", videos: [
        "04 - Daily and 1-Hour Confirmed Divergence Setup/001 AUDNZD Short.mp4",
        "04 - Daily and 1-Hour Confirmed Divergence Setup/002 Bitcoin Short.mp4",
        "04 - Daily and 1-Hour Confirmed Divergence Setup/003 Cardano Short.mp4",
        "04 - Daily and 1-Hour Confirmed Divergence Setup/004 GBPCAD Long.mp4",
        "04 - Daily and 1-Hour Confirmed Divergence Setup/005 NZDUSD Short.mp4",
      ]},
      { title: "4-Hour & 15-Minute Setups", videos: [
        "05 - 4-Hour and 15-Minute Confirmed Divergence/001 AUDCHF Long.mp4",
        "05 - 4-Hour and 15-Minute Confirmed Divergence/002 CADJPY Long.mp4",
        "05 - 4-Hour and 15-Minute Confirmed Divergence/003 German Dax Long.mp4",
        "05 - 4-Hour and 15-Minute Confirmed Divergence/004 S&P500 Short.mp4",
      ]},
      { title: "Live Trades", videos: [
        "06 - TRADES/001 JP225 Short Trade April 5, 2022.mp4",
      ]},
    ]
  },
  {
    title: "Forex Trading: Learn How To Trade Like A Pro",
    root: "[ FreeCryptoLearn.com ] Udemy - Forex Trading Course - Learn How To Trade Like A Pro Trader!/~Get Your Files Here !",
    sections: [
      { title: "Start Here", videos: [
        "1. Start Here/2. Course Overview.mp4",
      ]},
      { title: "Forex Strategy: Low Risk, High Probability Setups", videos: [
        "2. Forex Trading Strategy - How To Identify Low Risk, High Probability Trade Setups/1. Prerequisite Chart Setup.mp4",
        "2. Forex Trading Strategy - How To Identify Low Risk, High Probability Trade Setups/2. The Strategy's Edge.mp4",
        "2. Forex Trading Strategy - How To Identify Low Risk, High Probability Trade Setups/3. The Simple 5-Step Formula.mp4",
        "2. Forex Trading Strategy - How To Identify Low Risk, High Probability Trade Setups/4. Step 1 Trend Identification.mp4",
        "2. Forex Trading Strategy - How To Identify Low Risk, High Probability Trade Setups/5. Step 2 Trend Confirmation.mp4",
        "2. Forex Trading Strategy - How To Identify Low Risk, High Probability Trade Setups/6. Step 3 Trade - Entry Determination.mp4",
        "2. Forex Trading Strategy - How To Identify Low Risk, High Probability Trade Setups/7. Step 4 Stop - Loss Identification.mp4",
        "2. Forex Trading Strategy - How To Identify Low Risk, High Probability Trade Setups/8. Step 5 Profit - Target Determination.mp4",
        "2. Forex Trading Strategy - How To Identify Low Risk, High Probability Trade Setups/9. PRO TIP Lot Size Determination Hack.mp4",
      ]},
      { title: "Case Studies: Live Trade Examples", videos: [
        "3. Case Studies - Live Forex Trade Examples/1. Live Trade Example - EURUSD.mp4",
      ]},
      { title: "Risk Management", videos: [
        "4. Risk Management - How To Practice Proper Risk and Money Management Like A PRO!/1. Trade Like A Casino for Consistent Profits.mp4",
        "4. Risk Management - How To Practice Proper Risk and Money Management Like A PRO!/2. Forex Trading Performance Analysis.mp4",
      ]},
      { title: "Forex Trading Plan", videos: [
        "5. Forex Trading Plan - How To Develop A Fool - Proof, Winning Forex Trading Plan/1. Trading Psychology.mp4",
        "5. Forex Trading Plan - How To Develop A Fool - Proof, Winning Forex Trading Plan/2. S = Specific.mp4",
        "5. Forex Trading Plan - How To Develop A Fool - Proof, Winning Forex Trading Plan/3. M = Measurable.mp4",
        "5. Forex Trading Plan - How To Develop A Fool - Proof, Winning Forex Trading Plan/4. A = Achievable.mp4",
        "5. Forex Trading Plan - How To Develop A Fool - Proof, Winning Forex Trading Plan/5. R = Relevant.mp4",
        "5. Forex Trading Plan - How To Develop A Fool - Proof, Winning Forex Trading Plan/6. T = Time - Bound.mp4",
        "5. Forex Trading Plan - How To Develop A Fool - Proof, Winning Forex Trading Plan/7. Activity Setting Your SMART Forex Trading Goal.mp4",
      ]},
      { title: "How To Make Money Working 4 Hours A Week", videos: [
        "6. How To Make Money Through Forex Trading Working 4 Hours A Week or Less!/1. Trend Trading Strategy EA Setup.mp4",
        "6. How To Make Money Through Forex Trading Working 4 Hours A Week or Less!/2. MT4 Portable Mode Setup.mp4",
        "6. How To Make Money Through Forex Trading Working 4 Hours A Week or Less!/3. FREE VPS Setup.mp4",
        "6. How To Make Money Through Forex Trading Working 4 Hours A Week or Less!/4. Risk Management.mp4",
        "6. How To Make Money Through Forex Trading Working 4 Hours A Week or Less!/5. FREE Bonus Profitable Forex Trading Crash Course.mp4",
      ]},
    ]
  },
  {
    title: "How to Day Trade Stocks",
    root: "[ FreeCryptoLearn.com ] Udemy - How to Day Trade Stocks/~Get Your Files Here !",
    sections: [
      { title: "Complete Course", videos: [
        "1. 1. How to approach trading/1. How to approach stock trading.mp4",
        "2. 2. How the stock market works/1. How the stock market works..mp4",
        "3. 3. How stocks move/1. How stocks move..mp4",
        "4. 4. How much money do you need to trade/1. How much money do you need to trade..mp4",
        "5. 5. How to flip positions/1. How to flip positions..mp4",
        "6. 6. How to read the tape/1. How to read the tape..mp4",
        "7. 7. How to minimize and deal with losses/1. How to minimize and deal with losses..mp4",
        "8. 8. Combining technical indicators with intuition/1. Combining technical indicators with intuition..mp4",
        "9. 9. How to use technical analysis/1. How to use technical analysis..mp4",
        "10. 10. How to design your own trading strategy/1. How to design your own trading strategy..mp4",
        "11. 11. How to handle psychological effects of trading/1. How to handle psychological effects of trading..mp4",
        "12. 12. Market timing and periods/1. Market timing and periods..mp4",
        "13. 13. How to take profits/1. How to take profits..mp4",
        "14. 14. Why trading should not become your life/1. Why trading should not become your life..mp4",
      ]},
    ]
  },
  {
    title: "No-Coding Profitable Algorithmic Trading (TradingView)",
    root: "[ FreeCryptoLearn.com ] Udemy - No-Coding Profitable Algorithmic Trading using Tradingview!/~Get Your Files Here !",
    _dynamicLoad: true,
    sections: [
      { title: "Phase 1: Why Almost All Traders Lose Money", videos: [] },
      { title: "Phase 2: Different Ways of Trading the Market", videos: [] },
      { title: "Phase 3: How Automated & Algorithmic Trading Works", videos: [] },
      { title: "Phase 4: Must-Know Considerations Before Designing a System", videos: [] },
      { title: "Phase 5: Defining and Testing Your Trading Idea", videos: [] },
      { title: "Phase 6: Must-Know Before Backtesting", videos: [] },
      { title: "Phase 7: How to Backtest on TradingView", videos: [] },
      { title: "Phase 8: How to Automate a Trading Strategy", videos: [] },
      { title: "Extra: How One Trader Turned $5K to $10M", videos: [] },
      { title: "Extra: Tweaking and Enhancing Systems", videos: [] },
      { title: "Extra: The Best Trading Indicator", videos: [] },
      { title: "Extra: Everything About Trends & Trend Following", videos: [] },
      { title: "Extra: How to Use Stop Losses Properly", videos: [] },
      { title: "Extra: Position Sizing", videos: [] },
      { title: "Extra: On Cutting Losses", videos: [] },
      { title: "Extra: Risk and Risk Management", videos: [] },
      { title: "Extra: On Trade Entries", videos: [] },
      { title: "Extra: Predicting Markets & Market Fundamentals", videos: [] },
      { title: "Extra: On Pyramiding", videos: [] },
      { title: "Extra: Thoughts on Trading Systems", videos: [] },
      { title: "Extra: Beliefs for Emotional Control", videos: [] },
      { title: "Extra: Final Suggestions for New Traders", videos: [] },
      { title: "Final Section: Accelerate Your Growth", videos: [] },
    ]
  },
  {
    title: "Straightforward Guide on How to Use TradingView",
    root: "[ FreeCryptoLearn.com ] Udemy - Straightforward Guide on how to use TradingView/~Get Your Files Here !",
    sections: [
      { title: "Complete Course", videos: [
        "1. Introduction.mp4",
        "2. Lesson 1.mp4",
        "3. Lesson 2.mp4",
        "4. Lesson 3.mp4",
        "5. Lesson 4.mp4",
        "6. Lesson 5.mp4",
        "7. Lesson 6.mp4",
        "8. Conclusion.mp4",
      ]},
    ]
  },
  {
    title: "Trading View Mastery: Unlock Your TradingView Potential",
    root: "[ FreeCryptoLearn.com ] Udemy - Trading View Mastery - Unlock Your TradingView Potential/~Get Your Files Here !",
    sections: [
      { title: "Foundations of Smart Investing", videos: [
        "1. Foundations of Smart Investing/1. Lesson 1 Mastering Money Management for Smart Investments.mp4",
        "1. Foundations of Smart Investing/2. Optimal Portfolio Allocation Balancing Risks for Maximum Returns.mp4",
        "1. Foundations of Smart Investing/3. Understanding Investment Performance and Correlations.mp4",
      ]},
      { title: "Analyzing Investment Trends and Strategies", videos: [
        "2. Analyzing Investment Trends and Strategies/1. Reading Market Signals Understanding Investment Life Cycles.mp4",
        "2. Analyzing Investment Trends and Strategies/2. Navigating TradingView Your Ultimate Investment Platform.mp4",
        "2. Analyzing Investment Trends and Strategies/3. Mastering Portfolio Management Strategies for Investment Success.mp4",
      ]},
      { title: "Building and Optimizing Your Portfolio", videos: [
        "3. Building and Optimizing Your Investment Portfolio/1. Building an Optimal Portfolio Balancing Active and Passive Strategies.mp4",
        "3. Building and Optimizing Your Investment Portfolio/2. Understanding Active and Passive Portfolio Strategies.mp4",
        "3. Building and Optimizing Your Investment Portfolio/3. Understanding Demand Analysis and Correlation in Stock Trading.mp4",
        "3. Building and Optimizing Your Investment Portfolio/4. Portfolio Diversification.mp4",
      ]},
    ]
  },
  {
    title: "Learn To Trade Stocks and Crypto Like the Professionals",
    root: "[ WebToolTip.com ] Udemy - Learn To Trade Stocks and Crypto Like the Professionals/~Get Your Files Here !",
    sections: [
      { title: "Welcome to The World of Investment Trading", videos: [
        "1 - Welcome to The World of Investment Trading/1 - Welcome.mp4",
      ]},
      { title: "Mastering TradingView", videos: [
        "2 - Mastering Trading View/1 - Registering & Navigating Trading View.mp4",
        "2 - Mastering Trading View/2 - Using The Manual Fib Tool.mp4",
        "2 - Mastering Trading View/3 - Choosing Your MarketWatch Stocks & Crypto.mp4",
      ]},
      { title: "Trading With eToro & Other Platforms", videos: [
        "3 - Trading With Etoro & Other Platforms/1 - Introduction To Trading Platforms.mp4",
        "3 - Trading With Etoro & Other Platforms/2 - Opening A Trade On eToro.mp4",
        "3 - Trading With Etoro & Other Platforms/3 - Closing A Trade On eToro.mp4",
      ]},
      { title: "Stocks Trader Pro Strategy", videos: [
        "4 - Learning The Stocks Trader Pro Strategy/1 - Stocks Trader Pro Strategy.mp4",
        "4 - Learning The Stocks Trader Pro Strategy/2 - Stocks Trader Pro Strategy Example - TESLA.mp4",
        "4 - Learning The Stocks Trader Pro Strategy/3 - Stocks Trader Pro Strategy Example - SOL.mp4",
        "4 - Learning The Stocks Trader Pro Strategy/4 - Stocks Trader Pro Strategy Example - Coke.mp4",
        "4 - Learning The Stocks Trader Pro Strategy/5 - Stocks Trader Pro Strategy Example - SPDR.mp4",
        "4 - Learning The Stocks Trader Pro Strategy/6 - Risk Management.mp4",
      ]},
      { title: "Trading Investor Mindset", videos: [
        "5 - Developing a Trading Investor's Mindset/1 - Trading Investor Mindset.mp4",
      ]},
      { title: "Trade Tracker", videos: [
        "6 - Using The Stocks & Crypto Trade Tracker/1 - Stocks & Crypto Trade Tracker.mp4",
      ]},
      { title: "Extended Learning", videos: [
        "7 - Extended Learning Videos/1 - Crypto - The good, The Bad and The Ugly.mp4",
        "7 - Extended Learning Videos/2 - Benefiting From Market Gaps.mp4",
      ]},
    ]
  },
  {
    title: "Learn TradingView Pine Script Programming From Scratch",
    root: "[GigaCourse.Com] Udemy - Learn TradingView Pine Script Programming From Scratch",
    sections: [
      { title: "Introduction", videos: ["1. Introduction/1. Who am I.mp4"] },
      { title: "Quickstart", videos: ["2. Quickstart/1. Quickstart.mp4"] },
      { title: "Basic Syntax", videos: [
        "3. Basic Syntax/1. Overview & Structure of a Pine Script.mp4",
        "3. Basic Syntax/2. Versions.mp4",
        "3. Basic Syntax/3. Study vs. Strategy.mp4",
        "3. Basic Syntax/4. Lines & Indentation.mp4",
        "3. Basic Syntax/5. Comments.mp4",
        "3. Basic Syntax/6. Recap.mp4",
      ]},
      { title: "Variables", videos: [
        "4. Variables/1. Overview & Identifiers.mp4",
        "4. Variables/2. Variable Types & Assignment.mp4",
        "4. Variables/3. Variable Types - na Type.mp4",
        "4. Variables/4. Built-in Variables.mp4",
        "4. Variables/5. Variable Forms.mp4",
      ]},
      { title: "Variable Operations", videos: [
        "5. Variable Operations/1. Arithmetic Operators.mp4",
        "5. Variable Operations/2. Comparison Operators.mp4",
        "5. Variable Operations/3. Logical Operators.mp4",
      ]},
      { title: "Drawing On The Chart", videos: [
        "6. Drawing On The Chart/1. Intro.mp4",
        "6. Drawing On The Chart/2. How To Make Your Indicator Plot Over the Chart.mp4",
        "6. Drawing On The Chart/3. Using the plot() function.mp4",
        "6. Drawing On The Chart/4. User Inputs with input().mp4",
        "6. Drawing On The Chart/5. Plot prices levels with hline().mp4",
        "6. Drawing On The Chart/6. Coloring Backgrounds with bgcolor() & fill().mp4",
        "6. Drawing On The Chart/7. Coloring Candles.mp4",
        "6. Drawing On The Chart/8. Arrows & Shapes using plotarrow() & plotshape().mp4",
        "6. Drawing On The Chart/9. Plotting Unicode & Emojis with plotchar().mp4",
        "6. Drawing On The Chart/10. Using Custom Candles to View More Charts on One Layout (PREMIUM HACK).mp4",
        "6. Drawing On The Chart/11. Plotting Examples.mp4",
        "6. Drawing On The Chart/12. PROJECT - Part 1 - Building an indicator from multiple indicators.mp4",
      ]},
      { title: "Conditional Operations", videos: [
        "7. Conditional Operations/1.  Ternary Operator + Build a Color Selector.mp4",
        "7. Conditional Operations/2. iff() Function.mp4",
        "7. Conditional Operations/3. if Statement.mp4",
        "7. Conditional Operations/4. Recap Bring it all Together.mp4",
        "7. Conditional Operations/5. PROJECT - Part 2 - Build a Signal Generator from our Multi Indicator.mp4",
      ]},
      { title: "Functions", videos: [
        "8. Functions/1. Overview & Syntax.mp4",
        "8. Functions/2. Single & Multi Line Custom Function Examples.mp4",
        "8. Functions/3. Keyword Arguments.mp4",
        "8. Functions/4. Scope.mp4",
        "8. Functions/5. Mini Project Build a Counter.mp4",
        "8. Functions/6. Returning Multiple Results With Tuples.mp4",
        "8. Functions/7. Function Execution.mp4",
        "8. Functions/8. Recap.mp4",
        "8. Functions/9. var operator.mp4",
        "8. Functions/10. PROJECT Part 3 - Make a Multi Strategy Back Tester.mp4",
      ]},
      { title: "Wrapping Up", videos: ["9. Wrapping Up/1. Additional Resources & Next Steps.mp4"] },
    ]
  },
  {
    title: "TradingView Pine Script Strategies: The Complete Guide",
    root: "[GigaCourse.Com] Udemy - Tradingview Pine Script Strategies The Complete Guide",
    sections: [
      { title: "Quickstart", videos: [
        "1. Quickstart/1. What are strategies, backtesting & fowardtesting.mp4",
        "1. Quickstart/2. Top 8 Reasons to Build A Strategy in Pinescript.mp4",
        "1. Quickstart/3. How to build a strategy in Pinescript.mp4",
      ]},
      { title: "Analysing Pine Script Strategy Results", videos: [
        "2. Analysing Pine Script Strategy Results/1. Overview.mp4",
        "2. Analysing Pine Script Strategy Results/2. Performance Tab.mp4",
        "2. Analysing Pine Script Strategy Results/3. Overview Tab.mp4",
        "2. Analysing Pine Script Strategy Results/4. List of Trades Tab.mp4",
      ]},
      { title: "Standard Order Types", videos: [
        "3. Pine Script Standard Order Types/1. Overview.mp4",
        "3. Pine Script Standard Order Types/2. Reviewing Order Types.mp4",
        "3. Pine Script Standard Order Types/3. Strategy Commands Overview.mp4",
        "3. Pine Script Standard Order Types/4. Converting a Pine Script RSI Indicator Study to an RSI Strategy.mp4",
        "3. Pine Script Standard Order Types/5. Code Layout.mp4",
        "3. Pine Script Standard Order Types/6. How To Enter A Trade Using Market Orders With strategy.entry And strategy.order.mp4",
        "3. Pine Script Standard Order Types/7. What's The Difference Between strategy.entry And strategy.order.mp4",
        "3. Pine Script Standard Order Types/8. How To Exit A Trade Using Market Orders With strategy.close & strategy.close_all.mp4",
        "3. Pine Script Standard Order Types/9. How To Place A Limit Entry Order In Pinescript.mp4",
        "3. Pine Script Standard Order Types/10. How To Place A Stop Entry Order In Tradingview Pinescript.mp4",
        "3. Pine Script Standard Order Types/11. How To Visualize Pending Orders In Tradingview Pinescript.mp4",
        "3. Pine Script Standard Order Types/12. How To Cancel An Order In Pinescript.mp4",
      ]},
      { title: "Advanced Order Types", videos: [
        "4. Pinescript Advanced Order Types/2. How To Place a Percentage Take Profit In PineScript.mp4",
        "4. Pinescript Advanced Order Types/3. How To Place A Take Profit Using Ticks With Pinescript.mp4",
        "4. Pinescript Advanced Order Types/4. How To Place A Stop Loss In Pinescript.mp4",
        "4. Pinescript Advanced Order Types/5. How To Place A Stop-Limit Order In Pinescript.mp4",
        "4. Pinescript Advanced Order Types/6. How To Place An OCO Order In Pinescript.mp4",
        "4. Pinescript Advanced Order Types/7. How To Place A Trailing Stop In Pinescript.mp4",
      ]},
      { title: "Understanding The Broker Emulator", videos: [
        "5. Understanding The Broker Emulator/1. Script Calculation.mp4",
        "5. Understanding The Broker Emulator/2. Order Execution.mp4",
        "5. Understanding The Broker Emulator/3. How Does The Broker Emulator Work In Pinescript.mp4",
      ]},
      { title: "Practical Examples", videos: [
        "6. Practical Examples/1. Forex 50 Pips A Day Strategy.mp4",
        "6. Practical Examples/2. Forex 1 Hour MACD Strategy.mp4",
        "6. Practical Examples/3. Forex 1 Hour MACD Strategy - Part 2 Filtering Noise & Custom Settings..mp4",
        "6. Practical Examples/4. Introduction To External Indicators & PineCoders Legendary Backtesting Engine.mp4",
        "6. Practical Examples/5. Popular Adaptive Hull Moving Average Indicator Converted To A Strategy..mp4",
        "6. Practical Examples/6. Crypto BNB Burn Buyer Strategy.mp4",
      ]},
    ]
  },
];

// Library state
let _libDirHandle = null;
let _libWatched = JSON.parse(localStorage.getItem('td_lib_watched') || '{}');
const _libExpanded = new Set();
let _libDynamicLoaded = new Set();
let _libViewerBlobUrl = null;
let _libFileIndex = new Map(); // lowercased filename → FileSystemFileHandle
let _libEpubRendition = null;

// Helper: count total hardcoded videos (excluding dynamic course)
function _libTotalVideos() {
  return LIB_COURSES.reduce((sum, c) => {
    if (c._dynamicLoad) return sum;
    return sum + c.sections.reduce((s2, sec) => s2 + sec.videos.length, 0);
  }, 0);
}

function _libWatchedCount() {
  return Object.values(_libWatched).filter(Boolean).length;
}

// Recursively build a filename → handle index so we never rely on exact folder paths
async function _buildFileIndex(dirHandle, depth) {
  if (depth > 8) return;
  try {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        _libFileIndex.set(entry.name.toLowerCase(), entry);
      } else if (entry.kind === 'directory') {
        await _buildFileIndex(entry, depth + 1);
      }
    }
  } catch(e) { /* skip inaccessible subfolders */ }
}

// Connect folder via File System Access API
async function connectLibraryFolder() {
  try {
    _libDirHandle = await window.showDirectoryPicker({ mode: 'read' });
    localStorage.setItem('td_lib_connected_name', _libDirHandle.name);

    const statusEl = document.getElementById('lib-status');
    if (statusEl) { statusEl.className = 'lib-status-connected'; statusEl.textContent = '⏳ Indexing files...'; }

    _libFileIndex = new Map();
    await _buildFileIndex(_libDirHandle, 0);

    renderLibrary();

    const outEl = document.getElementById('lib-scan-output');
    const listEl = document.getElementById('lib-scan-list');
    if (outEl && listEl) {
      outEl.style.display = '';
      listEl.textContent = _libFileIndex.size + ' files indexed from ' + _libDirHandle.name;
    }
  } catch(e) {
    if (e.name !== 'AbortError') alert('Could not connect folder: ' + e.message);
  }
}

// Look up a file by its filename (last path segment) — ignores folder structure entirely
async function _libTraverse(pathStr) {
  const filename = pathStr.split('/').pop();
  const handle = _libFileIndex.get(filename.toLowerCase());
  if (!handle) throw new Error('File not found in index: "' + filename + '"');
  return await handle.getFile();
}

// MIME type map for reliable inline rendering
const _libMimeMap = {
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska',
  m4v: 'video/mp4', avi: 'video/x-msvideo',
  pdf: 'application/pdf',
  epub: 'application/epub+zip',
};

// Open a file in the embedded viewer
async function openLibraryFile(relPath) {
  if (!_libDirHandle) { alert('Connect your TG folder first.'); return; }
  try {
    const file = await _libTraverse(relPath);
    if (_libViewerBlobUrl) URL.revokeObjectURL(_libViewerBlobUrl);

    const ext = relPath.split('.').pop().toLowerCase();
    const rawName = relPath.split('/').pop().replace(/\.[^.]+$/, '');
    const title = rawName.replace(/[-_]/g, ' ').replace(/^\d+\s*/, '');

    // Force correct MIME type so browser renders inline instead of downloading
    const mime = _libMimeMap[ext] || file.type || 'application/octet-stream';
    const typedBlob = file.slice(0, file.size, mime); // efficient — no data copy
    _libViewerBlobUrl = URL.createObjectURL(typedBlob);

    const viewer = document.getElementById('lib-viewer');
    const videoEl = document.getElementById('lib-viewer-video');
    const iframeEl = document.getElementById('lib-viewer-iframe');
    const dlRow = document.getElementById('lib-viewer-dl-row');

    document.getElementById('lib-viewer-title').textContent = title;

    if (['mp4', 'mov', 'webm', 'mkv', 'm4v', 'avi'].includes(ext)) {
      videoEl.src = _libViewerBlobUrl;
      videoEl.style.display = '';
      iframeEl.style.display = 'none';
      iframeEl.src = '';
      if (dlRow) dlRow.style.display = 'none';
      viewer.style.display = 'flex';
      videoEl.focus();
    } else if (ext === 'pdf') {
      iframeEl.src = _libViewerBlobUrl;
      iframeEl.style.display = '';
      videoEl.style.display = 'none';
      videoEl.src = '';
      if (dlRow) dlRow.style.display = 'none';
      viewer.style.display = 'flex';
    } else if (ext === 'epub') {
      // Render EPUB in-browser using epub.js
      const epubEl = document.getElementById('lib-viewer-epub');
      videoEl.style.display = 'none';
      iframeEl.style.display = 'none';
      if (dlRow) dlRow.style.display = 'none';
      if (epubEl) {
        epubEl.style.display = '';
        epubEl.innerHTML = '';
        if (_libEpubRendition) { try { _libEpubRendition.destroy(); } catch(ex) {} _libEpubRendition = null; }
        // epub.js reads the file as an ArrayBuffer
        const buf = await file.arrayBuffer();
        const book = ePub(buf);
        _libEpubRendition = book.renderTo(epubEl, { width: '100%', height: '100%', spread: 'none', flow: 'scrolled-doc' });
        _libEpubRendition.display();
        // Add keyboard/click navigation
        _libEpubRendition.on('keydown', (e) => {
          if (e.key === 'ArrowRight') _libEpubRendition.next();
          if (e.key === 'ArrowLeft') _libEpubRendition.prev();
        });
      }
      viewer.style.display = 'flex';
    } else {
      // Unknown format — download
      const a = document.createElement('a');
      a.href = _libViewerBlobUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      videoEl.style.display = 'none';
      iframeEl.style.display = 'none';
      const epubEl = document.getElementById('lib-viewer-epub');
      if (epubEl) epubEl.style.display = 'none';
      if (dlRow) {
        const msg = dlRow.querySelector('.lib-viewer-dl-msg');
        if (msg) msg.textContent = '"' + file.name + '" downloaded.';
        const btn = dlRow.querySelector('.lib-viewer-dl-btn');
        if (btn) { btn.href = _libViewerBlobUrl; btn.download = file.name; btn.style.display = ''; btn.textContent = '⬇ Download Again'; }
        dlRow.style.display = '';
      }
      viewer.style.display = 'flex';
    }
  } catch(e) {
    // Show error inside the viewer (not alert) so user doesn't lose context
    const viewer = document.getElementById('lib-viewer');
    const videoEl = document.getElementById('lib-viewer-video');
    const iframeEl = document.getElementById('lib-viewer-iframe');
    const dlRow = document.getElementById('lib-viewer-dl-row');
    document.getElementById('lib-viewer-title').textContent = 'Error opening file';
    if (videoEl) { videoEl.style.display = 'none'; videoEl.src = ''; }
    if (iframeEl) { iframeEl.style.display = 'none'; iframeEl.src = ''; }
    if (dlRow) {
      const msg = dlRow.querySelector('.lib-viewer-dl-msg');
      if (msg) msg.innerHTML =
        '<strong style="color:var(--warn)">Could not open:</strong> ' + relPath.split('/').pop() +
        '<br><br><strong>Error:</strong> ' + e.message +
        '<br><br>This usually means the folder name on disk doesn\'t match exactly. Check the "Folder Contents" list above to verify your paths.';
      const btn = dlRow.querySelector('.lib-viewer-dl-btn');
      if (btn) btn.style.display = 'none';
      dlRow.style.display = '';
    }
    if (viewer) viewer.style.display = 'flex';
  }
}

function closeLibViewer() {
  const viewer = document.getElementById('lib-viewer');
  const videoEl = document.getElementById('lib-viewer-video');
  const iframeEl = document.getElementById('lib-viewer-iframe');
  const epubEl = document.getElementById('lib-viewer-epub');
  viewer.style.display = 'none';
  videoEl.pause();
  videoEl.src = '';
  iframeEl.src = '';
  if (epubEl) { epubEl.style.display = 'none'; epubEl.innerHTML = ''; }
  if (_libEpubRendition) { try { _libEpubRendition.destroy(); } catch(e) {} _libEpubRendition = null; }
  if (_libViewerBlobUrl) { URL.revokeObjectURL(_libViewerBlobUrl); _libViewerBlobUrl = null; }
}

// Toggle watched state for a video
function toggleLibWatched(videoId) {
  _libWatched[videoId] = !_libWatched[videoId];
  if (!_libWatched[videoId]) delete _libWatched[videoId];
  dbSet('td_lib_watched', _libWatched);
  updateLibProgress();
}

// Toggle accordion open/close for a course
function toggleCourseAccordion(idx) {
  if (_libExpanded.has(idx)) {
    _libExpanded.delete(idx);
  } else {
    _libExpanded.add(idx);
    if (LIB_COURSES[idx]._dynamicLoad && !_libDynamicLoaded.has(idx)) {
      loadCourseVideos(idx);
    }
  }
  // Re-render just the course card
  const container = document.getElementById('lib-courses-list');
  if (!container) return;
  const card = container.querySelector('[data-course-idx="' + idx + '"]');
  if (card) {
    const newCard = _buildCourseCard(LIB_COURSES[idx], idx);
    card.replaceWith(newCard);
  }
}

// Dynamic video loading for No-Coding Algorithmic course
async function loadCourseVideos(courseIdx) {
  if (!_libDirHandle) return;
  const course = LIB_COURSES[courseIdx];
  const container = document.getElementById('lib-courses-list');
  const card = container ? container.querySelector('[data-course-idx="' + courseIdx + '"]') : null;
  const bodyEl = card ? card.querySelector('.lib-course-body') : null;
  if (bodyEl) {
    bodyEl.innerHTML = '<div class="lib-section-group"><div class="lib-loading">Loading videos from folder...</div></div>';
  }

  try {
    const rootParts = course.root.split('/');
    let rootHandle = _libDirHandle;
    for (const part of rootParts) {
      rootHandle = await rootHandle.getDirectoryHandle(part);
    }

    // For each section, try to read the folder
    for (let si = 0; si < course.sections.length; si++) {
      const sec = course.sections[si];
      const sectionFolderName = sec.title; // try by title first
      try {
        // Try to find a matching folder by iterating directory entries
        const entries = [];
        for await (const entry of rootHandle.values()) {
          if (entry.kind === 'directory') entries.push(entry);
        }
        // find closest match by looking for a folder that includes key words from sec.title
        const keywords = sec.title.replace(/[^a-zA-Z0-9 ]/g, '').toLowerCase().split(' ').filter(w => w.length > 3);
        let sectionDir = null;
        for (const entry of entries) {
          const eName = entry.name.toLowerCase();
          if (keywords.some(kw => eName.includes(kw))) { sectionDir = entry; break; }
        }
        if (!sectionDir) continue;

        // Get all mp4 files in this directory, sorted
        const videoFiles = [];
        for await (const f of sectionDir.values()) {
          if (f.kind === 'file' && f.name.toLowerCase().endsWith('.mp4')) {
            videoFiles.push(f.name);
          }
        }
        videoFiles.sort();
        course.sections[si].videos = videoFiles.map(fn => sectionDir.name + '/' + fn);
      } catch(e) { /* section folder not found, keep empty */ }
    }

    _libDynamicLoaded.add(courseIdx);
  } catch(e) {
    console.warn('Could not load dynamic course videos:', e);
  }

  // Re-render the card with loaded videos
  if (container) {
    const card2 = container.querySelector('[data-course-idx="' + courseIdx + '"]');
    if (card2) {
      const newCard = _buildCourseCard(course, courseIdx);
      card2.replaceWith(newCard);
    }
  }
  updateLibProgress();
}

// Clean video title for display
function _cleanVideoTitle(rawTitle) {
  return rawTitle
    .replace(/^\d+[\s\-\.]+/, '')
    .replace(/\.mp4$/i, '')
    .trim();
}

// Build a single course accordion card element
function _buildCourseCard(course, idx) {
  const isOpen = _libExpanded.has(idx);

  // Calculate video count and watched count for this course
  const totalVids = course.sections.reduce((s, sec) => s + sec.videos.length, 0);
  let watchedVids = 0;
  course.sections.forEach((sec, si) => {
    sec.videos.forEach(v => {
      const fname = v.split('/').pop();
      const vid = idx + '::' + si + '::' + fname;
      if (_libWatched[vid]) watchedVids++;
    });
  });

  const pct = totalVids > 0 ? Math.round((watchedVids / totalVids) * 100) : 0;
  const sectionCount = course.sections.length;

  const card = document.createElement('div');
  card.className = 'lib-course-card';
  card.dataset.courseIdx = idx;

  // Header
  const header = document.createElement('div');
  header.className = 'lib-course-header';
  header.onclick = () => toggleCourseAccordion(idx);
  header.innerHTML = `
    <span class="lib-course-title">${course.title}</span>
    <div class="lib-course-meta">
      <span class="lib-meta-badge">${sectionCount} section${sectionCount !== 1 ? 's' : ''}</span>
      <span class="lib-meta-badge">${totalVids} videos</span>
      <div class="lib-course-progress-wrap">
        <div class="lib-progress-bar-track">
          <div class="lib-progress-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="lib-progress-text">${watchedVids}/${totalVids}</div>
      </div>
    </div>
    <span class="lib-chevron${isOpen ? ' open' : ''}">&#9658;</span>
  `;
  card.appendChild(header);

  // Body (only when expanded)
  if (isOpen) {
    const body = document.createElement('div');
    body.className = 'lib-course-body';

    if (course._dynamicLoad && !_libDynamicLoaded.has(idx) && totalVids === 0) {
      body.innerHTML = '<div class="lib-section-group"><div class="lib-loading">Loading videos from folder...</div></div>';
    } else {
      course.sections.forEach((sec, si) => {
        const group = document.createElement('div');
        group.className = 'lib-section-group';

        const secTitle = document.createElement('div');
        secTitle.className = 'lib-section-title';
        secTitle.textContent = sec.title;
        group.appendChild(secTitle);

        if (sec.videos.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'lib-empty-section';
          empty.textContent = 'No videos in this section.';
          group.appendChild(empty);
        } else {
          sec.videos.forEach((v, vi) => {
            const fname = v.split('/').pop();
            const videoId = idx + '::' + si + '::' + fname;
            const isWatched = !!_libWatched[videoId];
            const displayTitle = _cleanVideoTitle(fname);
            const fullPath = course.root + '/' + v;

            const row = document.createElement('div');
            row.className = 'lib-video-row';
            row.innerHTML = `
              <span class="lib-video-num">${vi + 1}</span>
              <span class="lib-video-title${isWatched ? ' watched' : ''}" title="${displayTitle}">${displayTitle}</span>
              <input type="checkbox" class="lib-watch-cb" ${isWatched ? 'checked' : ''}
                onchange="toggleLibWatched('${videoId.replace(/'/g, "\\'")}')" title="Mark watched">
              <button class="lib-play-btn" onclick="openLibraryFile('${fullPath.replace(/'/g, "\\'")}')" title="Open file">&#9654; Play</button>
            `;
            group.appendChild(row);
          });
        }

        body.appendChild(group);
      });
    }
    card.appendChild(body);
  }

  return card;
}

// Update the progress summary and progress bars without full re-render
function updateLibProgress() {
  const watched = _libWatchedCount();
  const total = _libTotalVideos();
  const summaryEl = document.getElementById('lib-progress-summary');
  if (summaryEl) summaryEl.textContent = watched + ' / ' + total + ' videos watched';

  // Refresh all open course cards' progress bars
  const container = document.getElementById('lib-courses-list');
  if (!container) return;
  LIB_COURSES.forEach((course, idx) => {
    if (!_libExpanded.has(idx)) return;
    const card = container.querySelector('[data-course-idx="' + idx + '"]');
    if (!card) return;
    const totalVids = course.sections.reduce((s, sec) => s + sec.videos.length, 0);
    let watchedVids = 0;
    course.sections.forEach((sec, si) => {
      sec.videos.forEach(v => {
        const fname = v.split('/').pop();
        const vid = idx + '::' + si + '::' + fname;
        if (_libWatched[vid]) watchedVids++;
      });
    });
    const pct = totalVids > 0 ? Math.round((watchedVids / totalVids) * 100) : 0;
    const fill = card.querySelector('.lib-progress-bar-fill');
    const text = card.querySelector('.lib-progress-text');
    if (fill) fill.style.width = pct + '%';
    if (text) text.textContent = watchedVids + '/' + totalVids;
  });
}

// Full render of the library panel
function renderLibrary() {
  // Browser check
  const warnEl = document.getElementById('lib-browser-warn');
  if (warnEl) {
    warnEl.style.display = !('showDirectoryPicker' in window) ? '' : 'none';
  }

  // Connection status
  const statusEl = document.getElementById('lib-status');
  if (statusEl) {
    if (_libDirHandle) {
      statusEl.className = 'lib-status-connected';
      statusEl.textContent = '✓ Folder Connected: ' + _libDirHandle.name;
    } else {
      statusEl.className = 'lib-status-disconnected';
      statusEl.textContent = 'Not connected — click to connect';
    }
  }

  // Progress summary
  const total = _libTotalVideos();
  const watched = _libWatchedCount();
  const summaryEl = document.getElementById('lib-progress-summary');
  if (summaryEl) summaryEl.textContent = watched + ' / ' + total + ' videos watched';

  // Books grid
  const booksGrid = document.getElementById('lib-books-grid');
  if (booksGrid) {
    booksGrid.innerHTML = LIB_BOOKS.map(book => {
      const fmtClass = book.format === 'PDF' ? 'lib-format-pdf' : 'lib-format-epub';
      return `
        <div class="lib-book-card">
          <div class="lib-book-title">${book.title}</div>
          ${book.author ? '<div class="lib-book-author">by ' + book.author + '</div>' : ''}
          <div class="lib-book-footer">
            <span class="lib-format-badge ${fmtClass}">${book.format}</span>
            <button class="lib-open-btn" onclick="openLibraryFile('${book.path.replace(/'/g, "\\'")}')" title="Open ${book.title}">Open &#8594;</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Video count badge
  const videosCountEl = document.getElementById('lib-videos-count');
  if (videosCountEl) videosCountEl.textContent = total + ' videos';

  // Course list
  const coursesList = document.getElementById('lib-courses-list');
  if (coursesList) {
    coursesList.innerHTML = '';
    LIB_COURSES.forEach((course, idx) => {
      coursesList.appendChild(_buildCourseCard(course, idx));
    });
  }
}

// Initialize library on page load
(function initLibrary() {
  // Sync watched state from localStorage
  _libWatched = JSON.parse(localStorage.getItem('td_lib_watched') || '{}');
  renderLibrary();
})();

// ---- Load from Supabase (overwrites localStorage if newer data exists) ----
dbInit();
