# Nikki's TradeLab

A personal trading education and practice dashboard — live charts, position calculator, P&L journal, paper trading challenge, news feed, classroom, quiz, and an OneDrive-connected trading library.

**Live site:** https://nikkis-tradehub.vercel.app

---

## Project Structure

```
nikkis-tradehub/
├── index.html   — entire app: HTML, CSS, and JS all in one file
├── PRD.md       — product requirements
├── CLAUDE.md    — guidance for AI-assisted development
└── README.md    — this file
```

Everything lives in `index.html` — no build step, no framework, no separate CSS or JS files.

---

## Making Changes

1. Edit `index.html` directly
2. Open it in Chrome or Edge to preview locally
3. Push to deploy:

```bash
cd ~/nikkis-tradehub
git add index.html
git commit -m "describe what you changed"
git push
```

Vercel auto-deploys within ~30 seconds after every push to `main`.

---

## Local Preview

Open `index.html` directly in Chrome or Edge — no server needed.

---

## GitHub + Vercel

- **Repo:** https://github.com/nikkimasani/nikkis-tradehub
- **Hosting:** Vercel (auto-deploys on push to `main`)
