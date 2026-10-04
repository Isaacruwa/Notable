#!/usr/bin/env node
// Static blog generator for Kiver.
// Usage: node scripts/build-blog.js
// Reads blog-src/posts.json and writes blog/index.html, blog/<slug>/index.html,
// rss.xml and lib/blog-posts.json (used by api/sitemap.js).
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ORIGIN = (process.env.SITE_ORIGIN || "https://getkiver.com").replace(/\/$/, "");
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, "blog-src", "posts.json"), "utf8"))
  .sort((a, b) => (a.published < b.published ? 1 : -1));
const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const ld = (o) => '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, "\\u003c") + "</script>";
const write = (rel, data) => {
  const f = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, data);
};

const LOGO = '<span class="kiver-inline-logo" aria-label="Kiver" role="img"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="Kiver"><rect width="256" height="256" fill="#fff"/><circle cx="128" cy="58" r="17" fill="#090909"/><rect x="123" y="70" width="10" height="30" rx="5" fill="#090909"/><rect x="54" y="91" width="148" height="116" rx="43" fill="#090909"/><rect x="75" y="112" width="106" height="45" rx="23" fill="#fff"/><circle cx="98" cy="134" r="9" fill="#090909"/><circle cx="158" cy="134" r="9" fill="#090909"/><circle cx="127" cy="171" r="18" fill="none" stroke="#fff" stroke-width="8"/><path d="M141 185 L159 203" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/></svg></span>';

const header = (active) => `<header class="nav"><a class="brand" href="/">${LOGO}<span>Kiver</span></a><nav><a href="/directory">Discover</a><a href="/category/ai">Categories</a><a href="/blog"${active ? ' class="active"' : ""}>Blog</a><a href="/submit">For makers</a></nav><div class="nav-actions"><a class="nav-link" href="/login.html">Sign in</a><a class="nav-cta" href="/submit">Launch a bot</a></div></header>`;

const footer = `<footer><div><a class="brand" href="/">${LOGO}<span>Kiver</span></a><p>The discovery marketplace for Telegram bots.</p></div><div class="footer-links"><a href="/directory">Directory</a><a href="/blog">Blog</a><a href="/submit">Submit a bot</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="/refund.html">Refunds</a></div><small>© Kiver. Discover useful software, one bot at a time.</small></footer>`;

const head = ({ title, desc, url, image, imageAlt, type, extraMeta = "" }) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#ffffff"><meta name="application-name" content="Kiver"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${esc(url)}"><link rel="alternate" type="application/rss+xml" title="Kiver Blog" href="${ORIGIN}/rss.xml"><meta property="og:site_name" content="Kiver"><meta property="og:type" content="${type}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(imageAlt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(image)}">${extraMeta}<link rel="manifest" href="/manifest.json"><link rel="stylesheet" href="/app.css"><link rel="stylesheet" href="/blog.css?v=1"><link rel="icon" href="/favicon.ico?v=8" sizes="48x48"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=8"><link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png?v=8"><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=8"></head>`;

const card = (p) => `<a class="blog-card" href="/blog/${esc(p.slug)}"><img src="/blog/img/${esc(p.cover)}" alt="${esc(p.coverAlt)}" width="1200" height="630" loading="lazy"><div class="blog-card-body"><span class="blog-tag">${esc(p.category)}</span><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p><small>${esc(fmt(p.published))} · ${p.readMins} min read</small></div></a>`;

const cta = `<aside class="blog-cta"><div><span class="eyebrow">FOR TELEGRAM MAKERS</span><h2>Built a bot? Give it a place to be found.</h2><p>Paste your t.me link and Kiver creates a permanent, indexable page for your bot, with a category listing, votes and a shareable URL.</p></div><div class="blog-cta-actions"><a class="dark-button" href="/submit">Launch your bot on Kiver <span>→</span></a><a class="text-link" href="/directory">Browse the directory →</a></div></aside>`;

// ---- Post pages ----
for (const p of posts) {
  const url = `${ORIGIN}/blog/${p.slug}`;
  const image = `${ORIGIN}/blog/img/${p.cover}`;
  const toc = [...p.body.matchAll(/<h2 id="([^"]+)">(.*?)<\/h2>/g)].map((m) => ({ id: m[1], text: m[2] }));
  if (p.faq && p.faq.length) toc.push({ id: "faq", text: "Frequently asked questions" });
  const tocHtml = `<nav class="toc" aria-label="Table of contents"><strong>On this page</strong><ol>${toc.map((t) => `<li><a href="#${esc(t.id)}">${t.text}</a></li>`).join("")}</ol></nav>`;
  const faqHtml = p.faq && p.faq.length ? `<h2 id="faq">Frequently asked questions</h2>${p.faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("")}` : "";
  const related = (p.related || []).map((s) => bySlug[s]).filter(Boolean);
  const relatedHtml = related.length ? `<section class="blog-related"><h2>Keep reading</h2><div class="blog-grid">${related.map(card).join("")}</div></section>` : "";
  const ldArticle = {
    "@context": "https://schema.org", "@type": "BlogPosting",
    headline: p.title, description: p.description, image: [image],
    datePublished: p.published, dateModified: p.updated,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Organization", name: "Kiver", url: ORIGIN + "/" },
    publisher: { "@type": "Organization", name: "Kiver", logo: { "@type": "ImageObject", url: ORIGIN + "/kiver-logo.png" } },
  };
  const ldCrumbs = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: ORIGIN + "/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: ORIGIN + "/blog" },
      { "@type": "ListItem", position: 3, name: p.title, item: url },
    ],
  };
  const ldFaq = p.faq && p.faq.length ? ld({
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: p.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  }) : "";
  const extra = `<meta property="article:published_time" content="${p.published}"><meta property="article:modified_time" content="${p.updated}"><meta property="article:section" content="${esc(p.category)}">`;
  const html = head({ title: p.seoTitle || p.title, desc: p.description, url, image, imageAlt: p.coverAlt, type: "article", extraMeta: extra }) +
`<body>${header(true)}<main class="blog-main"><article class="post"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/blog">Blog</a><span>/</span><span aria-current="page">${esc(p.category)}</span></nav><header class="post-head"><span class="eyebrow">${esc(p.category.toUpperCase())} · ${p.readMins} MIN READ</span><h1>${esc(p.title)}</h1><p class="post-meta">Published ${esc(fmt(p.published))}${p.updated !== p.published ? " · Updated " + esc(fmt(p.updated)) : ""} · By the Kiver team</p></header><img class="post-cover" src="/blog/img/${esc(p.cover)}" alt="${esc(p.coverAlt)}" width="1200" height="630" fetchpriority="high">${tocHtml}<div class="post-body">${p.body}${faqHtml}</div>${cta}</article>${relatedHtml}</main>${footer}<script src="/app.js?v=11" defer></script>${ld(ldArticle)}${ld(ldCrumbs)}${ldFaq}</body></html>`;
  write(`blog/${p.slug}/index.html`, html);
}

// ---- Blog index ----
{
  const url = `${ORIGIN}/blog`;
  const title = "Kiver Blog: Telegram Bots, Growth and Income";
  const desc = "Guides for Telegram bot makers and creators: how to build a bot, get your first users and earn money on Telegram. From the team behind the Kiver bot directory.";
  const html = head({ title, desc, url, image: `${ORIGIN}/blog/img/kiver-blog-og.png`, imageAlt: "The Kiver Blog", type: "website" }) +
`<body>${header(true)}<main class="blog-main"><section class="blog-hero"><span class="eyebrow">THE KIVER BLOG</span><h1>Telegram bots, growth and income.</h1><p class="hero-lede">Practical guides for people who build, promote and earn with Telegram bots and channels.</p></section><section><div class="blog-grid">${posts.map(card).join("")}</div></section>${cta}</main>${footer}<script src="/app.js?v=11" defer></script>${ld({
    "@context": "https://schema.org", "@type": "Blog", name: "Kiver Blog", url, description: desc,
    publisher: { "@type": "Organization", name: "Kiver", logo: { "@type": "ImageObject", url: ORIGIN + "/kiver-logo.png" } },
    blogPost: posts.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${ORIGIN}/blog/${p.slug}`, datePublished: p.published, image: `${ORIGIN}/blog/img/${p.cover}` })),
  })}${ld({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: ORIGIN + "/" }, { "@type": "ListItem", position: 2, name: "Blog", item: url }],
  })}</body></html>`;
  write("blog/index.html", html);
}

// ---- RSS ----
{
  const items = posts.map((p) => `<item><title>${esc(p.title)}</title><link>${ORIGIN}/blog/${p.slug}</link><guid isPermaLink="true">${ORIGIN}/blog/${p.slug}</guid><pubDate>${new Date(p.published + "T00:00:00Z").toUTCString()}</pubDate><category>${esc(p.category)}</category><description>${esc(p.description)}</description></item>`).join("");
  write("rss.xml", `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Kiver Blog</title><link>${ORIGIN}/blog</link><description>Guides on Telegram bots, growth and income from the Kiver team.</description><language>en</language>${items}</channel></rss>`);
}

// ---- Sitemap data ----
write("lib/blog-posts.json", JSON.stringify(posts.map((p) => ({ slug: p.slug, updated: p.updated })), null, 1) + "\n");
console.log("Built " + posts.length + " posts");
