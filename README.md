# TGFoundry

TGFoundry is a Product Hunt / G2-style discovery platform for Telegram bots.

- Makers submit one public `t.me/<bot>` link.
- Public Telegram name, description, image and username are fetched automatically.
- Bots receive permanent server-rendered pages with canonical URLs, Open Graph metadata, JSON-LD and sitemap discovery.
- Community upvotes power discovery.
- Search, categories, top/new listings and maker submission are included.
- PWA manifest and service worker included.
- Vercel Cron refreshes stale Telegram metadata every six hours.

Required environment variable: `DATABASE_URL`.
Optional: `CRON_SECRET` to protect the scheduled refresh endpoint.