# Notable — Online Notability Intelligence

"How notable are you online?" — a scan-and-score product for people, brands, and companies.

## What's in this repo right now

A live, deployable site with a **real scanning pipeline**:
- `/index.html` — the full landing page (hero, live scan sequence, scoring breakdown, findings, share card, pricing)
- `/css/styles.css` — design system (OLED dark, glassmorphism, cyan/violet accents)
- `/js/main.js` — animations: radar sweep, log stream, carousel, score count-up, and the real fetch to `/api/scan`
- `/public/manifest.json` + `/public/sw.js` — PWA install support (installable on Android/desktop, offline app shell)
- `/api/scan.js` — the serverless endpoint the frontend calls
- `/lib/search.js` — pulls real web + news results for the entity from **Serper.dev**
- `/lib/claude.js` — sends that evidence to **Claude** for entity resolution, dedup/syndication detection, and scoring — grounded only in the evidence, nothing invented
- `/lib/mock.js` — deterministic mock, used automatically if the two API keys below aren't set, or as a safety fallback if the live pipeline ever errors

**It's safe to deploy right now either way.** Without the two keys below it runs the mock. With them, it runs the real thing.

### Turning on the real pipeline

1. Get a **Serper.dev** key (free trial credits, no card): https://serper.dev
2. Get an **Anthropic** key: https://console.anthropic.com
3. In Vercel: Project → Settings → Environment Variables, add:
   - `SERPER_API_KEY`
   - `ANTHROPIC_API_KEY`
4. Redeploy (or it'll pick them up on the next deploy automatically)

For local testing, copy `.env.example` to `.env.local`, fill in the keys, and run `vercel dev`.

Every scan response includes an `engine` field (`"live"`, `"mock"`, or `"mock-fallback"`) so you can see at a glance which path served it — useful while you're testing.

## Deploy: GitHub → Vercel

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Notable: phase 1 — live landing page + mocked scan"
   git branch -M main
   git remote add origin https://github.com/<your-username>/notable.git
   git push -u origin main
   ```

2. **Import into Vercel**
   - Go to vercel.com → **Add New → Project**
   - Import the GitHub repo
   - Framework preset: Vercel will auto-detect **"Other"** — leave build command and output directory blank. No config needed.
   - Click **Deploy**

   You'll get a live URL like `notable-yourname.vercel.app` immediately. When you buy a domain later, add it under Project → Settings → Domains — no code changes needed.

3. **Every future `git push` to `main` auto-deploys.** That's the whole workflow going forward.

## What's left, in order

| Piece | Purpose | Status |
|---|---|---|
| Web/news search (Serper.dev) | Find real mentions of the entity | ✅ Built |
| Claude scoring | Entity disambiguation, dedup/syndication detection, source-quality classification, gap analysis | ✅ Built |
| Database | Store scans, scores, users, so a report isn't lost on refresh | ⬜ Next |
| PDF generation | Downloadable Complete Report | ⬜ Next |
| Auth | Account dashboard, saved reports | ⬜ Next |
| Email | Monitoring alerts | ⬜ Next |
| Payments (Paddle) | Complete Report, Monitor subscription | ⬜ Last — once scoring is accurate and the product is fully functional |

Say the word for whichever's next and we'll build that one, provider by provider.

## Notes

- `/public/icons/` needs real 192×192 and 512×512 PNG app icons before the PWA install prompt looks polished — currently referencing placeholders. Drop your logo in and update `manifest.json` if the filenames change.
- All copy, scores, and profile names in the scan carousel are placeholder/fictional — safe to ship, update whenever real content is ready.
