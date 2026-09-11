// api/saas-index.js — Vercel serverless function (Node.js runtime)
//
// Server-renders the /saas leaderboard so it's fully crawlable and
// indexable on first load — no client JS required to see the
// ranking or follow a listing's outbound link. js/saas.js
// progressively enhances it afterward (upvote clicks).
//
// Routed here from a clean /saas URL via vercel.json rewrites.

const { listSaasLeaderboard, countSaasListings } = require('../lib/db');
const { escapeHtml, pageShell } = require('../lib/render');

const PAGE_SIZE = 25;
const SITE = 'https://www.getkiver.com';

module.exports = async function handler(req, res) {
  const category = req.query?.category ? String(req.query.category).slice(0, 60) : undefined;
  const page = Math.max(1, parseInt(req.query?.page, 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let rows = [];
  let total = 0;
  try {
    [rows, total] = await Promise.all([
      listSaasLeaderboard({ category, limit: PAGE_SIZE, offset }),
      countSaasListings(category)
    ]);
  } catch (err) {
    console.error('Leaderboard render failed:', err.message);
  }

  const qs = (p) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (p > 1) params.set('page', String(p));
    const s = params.toString();
    return s ? `/saas?${s}` : '/saas';
  };

  const rowsHtml = rows.length
    ? rows
        .map((r, i) => {
          const position = offset + i + 1;
          return `
    <li class="saas-row" data-slug="${escapeHtml(r.slug)}">
      <span class="saas-position">${position}</span>
      <a class="saas-name-link" href="/saas/${escapeHtml(r.slug)}">
        <span class="saas-name">${escapeHtml(r.name)}</span>
        <span class="saas-tagline">${escapeHtml(r.tagline || '')}</span>
      </a>
      <span class="saas-tier saas-tier-${escapeHtml((r.tier || 'new').toLowerCase())}">${escapeHtml(r.tier)}</span>
      <span class="saas-score">${r.base_score}%</span>
      <button class="saas-upvote" data-slug="${escapeHtml(r.slug)}" aria-label="Upvote ${escapeHtml(r.name)}">
        <span class="saas-upvote-arrow">&#9650;</span>
        <span class="saas-upvote-count">${r.upvotes}</span>
      </button>
    </li>`;
        })
        .join('')
    : `<li class="saas-empty">No listings yet &mdash; <a href="/submit-saas.html">be the first</a>.</li>`;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pagerHtml = totalPages > 1
    ? `<nav class="saas-pager">
        ${page > 1 ? `<a href="${qs(page - 1)}">&larr; Newer positions</a>` : '<span></span>'}
        <span>Page ${page} of ${totalPages}</span>
        ${page < totalPages ? `<a href="${qs(page + 1)}">Older positions &rarr;</a>` : '<span></span>'}
      </nav>`
    : '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Kiver SaaS Leaderboard',
    description: 'A score-ranked leaderboard of new SaaS products, 2025 and later. Position is earned, never paid for.',
    itemListElement: rows.map((r, i) => ({
      '@type': 'ListItem',
      position: offset + i + 1,
      url: `${SITE}/saas/${r.slug}`,
      name: r.name
    }))
  };

  const bodyHtml = `
<header class="saas-header">
  <a href="/" class="saas-brand">Kiver</a>
  <nav class="saas-nav">
    <a href="/saas" class="saas-nav-active">Leaderboard</a>
    <a href="/submit-saas.html">Submit your SaaS</a>
  </nav>
</header>
<main class="saas-main">
  <section class="saas-intro">
    <h1>The SaaS Leaderboard</h1>
    <p>Ranked by an independent notability score, not by who paid the most. Every product launched 2025 or later is welcome. Upvotes can move a listing from position 300 to position 1 &mdash; score just sets where it starts.</p>
    <a class="saas-cta" href="/submit-saas.html">Submit your SaaS &rarr;</a>
  </section>
  <ol class="saas-list">${rowsHtml}</ol>
  ${pagerHtml}
</main>
<footer class="saas-footer">
  <p>Position is score-based. Nobody pays to rank higher. <a href="/">Powered by Kiver</a></p>
</footer>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(pageShell({
    title: total ? 'SaaS Leaderboard — Top New SaaS of 2025+ | Kiver' : 'SaaS Leaderboard | Kiver',
    description: 'A score-ranked leaderboard of new SaaS products (2025+). No pay-to-play — position is earned by notability score and real upvotes.',
    canonical: `${SITE}${qs(page)}`,
    jsonLd,
    bodyHtml
  }));
};
