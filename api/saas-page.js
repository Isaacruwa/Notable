// api/saas-page.js — Vercel serverless function (Node.js runtime)
//
// Server-renders both SaaS Leaderboard page types from one function
// (to stay under this project's serverless function cap):
//   - /saas         (no slug in query)  -> leaderboard
//   - /saas/:slug   (slug in query)     -> single listing
// Fully crawlable on first load — no client JS required. Routed
// here via vercel.json rewrites.

const {
  listSaasLeaderboard,
  countSaasListings,
  getSaasListingBySlug,
  getSaasListingPosition
} = require('../lib/db');
const { escapeHtml, pageShell } = require('../lib/render');

const PAGE_SIZE = 25;
const SITE = 'https://www.getkiver.com';

async function renderIndex(req, res) {
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
}

async function renderDetail(req, res, slug) {
  let listing;
  try {
    listing = await getSaasListingBySlug(slug);
  } catch (err) {
    console.error('Listing lookup failed:', err.message);
    return res.status(500).send('Could not load this listing right now.');
  }

  if (!listing) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(pageShell({
      title: 'Listing not found | Kiver SaaS Leaderboard',
      description: 'This SaaS listing does not exist.',
      canonical: `${SITE}/saas/${escapeHtml(slug)}`,
      bodyHtml: `<main class="saas-main"><h1>Not found</h1><p>No listing here. <a href="/saas">Back to the leaderboard</a>.</p></main>`
    }));
  }

  let position = null;
  try {
    position = await getSaasListingPosition(listing.slug);
  } catch (err) {
    console.error('Position lookup failed (non-fatal):', err.message);
  }

  const canonical = `${SITE}/saas/${escapeHtml(slug)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: listing.name,
    description: listing.description || listing.tagline || undefined,
    url: listing.website_url,
    applicationCategory: listing.category || undefined,
    datePublished: listing.launch_year ? `${listing.launch_year}` : undefined
  };

  const bodyHtml = `
<header class="saas-header">
  <a href="/" class="saas-brand">Kiver</a>
  <nav class="saas-nav">
    <a href="/saas">Leaderboard</a>
    <a href="/submit-saas.html">Submit your SaaS</a>
  </nav>
</header>
<main class="saas-main saas-detail">
  <div class="saas-detail-top">
    ${position ? `<span class="saas-position-big">#${position}</span>` : ''}
    <div>
      <h1>${escapeHtml(listing.name)}</h1>
      <p class="saas-tagline">${escapeHtml(listing.tagline || '')}</p>
      <div class="saas-meta-row">
        <span class="saas-tier saas-tier-${escapeHtml((listing.tier || 'new').toLowerCase())}">${escapeHtml(listing.tier)}</span>
        <span class="saas-score-badge">${listing.base_score}% notability</span>
        ${listing.category ? `<span class="saas-category">${escapeHtml(listing.category)}</span>` : ''}
        ${listing.launch_year ? `<span class="saas-year">${listing.launch_year}</span>` : ''}
      </div>
    </div>
  </div>

  ${listing.description ? `<p class="saas-description">${escapeHtml(listing.description)}</p>` : ''}

  <div class="saas-detail-actions">
    <a class="saas-visit" href="${escapeHtml(listing.website_url)}" target="_blank" rel="noopener">Visit ${escapeHtml(listing.name)} &#8599;</a>
    <button class="saas-upvote saas-upvote-big" data-slug="${escapeHtml(listing.slug)}" aria-label="Upvote ${escapeHtml(listing.name)}">
      <span class="saas-upvote-arrow">&#9650;</span>
      <span class="saas-upvote-count">${listing.upvotes}</span>
    </button>
  </div>

  <p class="saas-fineprint">Notability score of ${listing.base_score}% set the entry point. Upvotes moved it the rest of the way &mdash; this position was earned, not bought.</p>
</main>
<footer class="saas-footer">
  <p><a href="/saas">&larr; Back to the leaderboard</a></p>
</footer>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(pageShell({
    title: `${listing.name} — ${listing.tagline || 'SaaS Leaderboard'} | Kiver`,
    description: (listing.description || listing.tagline || `${listing.name} on the Kiver SaaS Leaderboard.`).slice(0, 155),
    canonical,
    jsonLd,
    bodyHtml
  }));
}

module.exports = async function handler(req, res) {
  const slug = req.query?.slug ? String(req.query.slug).trim() : '';
  if (slug) {
    return renderDetail(req, res, slug);
  }
  return renderIndex(req, res);
};
