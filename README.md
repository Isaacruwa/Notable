# Kiver

Kiver is a Product Hunt-style discovery marketplace for Telegram bots.

## Product

- Discover Telegram bots through a ranked, searchable directory.
- Every approved bot receives a permanent server-rendered product page.
- Makers submit a public `t.me/<bot>` URL and Kiver fetches public metadata automatically.
- Community upvotes, reviews and discussion create discovery signals.
- Categories and query URLs provide crawlable entry points.
- Sitemap, robots.txt, canonical URLs, OpenGraph and JSON-LD are included.
- PWA manifest and service worker are included.

## Stack

Vercel serverless functions, Neon Postgres and vanilla HTML/CSS/JavaScript.

## Environment

Required: `DATABASE_URL`.

Optional: `CRON_SECRET` to protect the scheduled metadata refresh endpoint.

Password reset email delivery uses the Production `BREVO_API_KEY` environment variable.

## Blog

Static blog at `/blog`. Posts live in `blog-src/posts.json`; run `node scripts/build-blog.js` to regenerate `blog/`, `rss.xml` and `lib/blog-posts.json` (used by the sitemap). Images go in `blog/img/`; styles in `blog.css`.
