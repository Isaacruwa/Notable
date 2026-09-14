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

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'ai', label: 'AI' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'developer-tools', label: 'Developer Tools' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'finance', label: 'Finance' },
  { value: 'design', label: 'Design' },
  { value: 'other', label: 'Other' }
];

async function renderIndex(req, res) {
  const category = req.query?.category ? String(req.query.category).slice(0, 60) : undefined;
  const sort = req.query?.sort === 'new' ? 'new' : 'top';
  const page = Math.max(1, parseInt(req.query?.page, 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let rows = [];
  let total = 0;
  try {
    [rows, total] = await Promise.all([
      listSaasLeaderboard({ category, limit: PAGE_SIZE, offset, sort }),
      countSaasListings(category)
    ]);
  } catch (err) {
    console.error('Leaderboard render failed:', err.message);
  }

  const qs = (p, overrides = {}) => {
    const params = new URLSearchParams();
    const c = overrides.category !== undefined ? overrides.category : category;
    const s = overrides.sort !== undefined ? overrides.sort : sort;
    if (c) params.set('category', c);
    if (s === 'new') params.set('sort', 'new');
    if (p > 1) params.set('page', String(p));
    const str = params.toString();
    return str ? `/saas?${str}` : '/saas';
  };

  const rowsHtml = rows.length
    ? rows
        .map((r, i) => {
          const position = offset + i + 1;
          return `
    <li class="saas-row" data-slug="${escapeHtml(r.slug)}">
      <span class="saas-position">${position}</span>
      <span class="saas-logo-wrap">
        <img class="saas-logo" src="${escapeHtml(r.logo_url || '')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      </span>
      <a class="saas-name-link" href="/saas/${escapeHtml(r.slug)}">
        <span class="saas-name">${escapeHtml(r.name)}</span>
        <span class="saas-tagline">${escapeHtml(r.tagline || '')}</span>
      </a>
      <span class="saas-meta">
        ${r.category ? `<span class="saas-category-chip">${escapeHtml(r.category)}</span>` : ''}
        <span class="saas-tier saas-tier-${escapeHtml((r.tier || 'new').toLowerCase())}">${r.tier === 'Elite' ? '&#9733; ' : ''}${escapeHtml(r.tier)}</span>
        <span class="saas-score">${r.base_score}%</span>
      </span>
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
<nav>
  <div class="wrap">
    <div class="logo"><span class="mark"></span>Kiver</div>
    <div class="nav-menu">
      <button class="nav-menu-btn" id="navMenuBtn" type="button" aria-haspopup="true" aria-expanded="false">
        Menu
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="nav-menu-panel" id="navMenuPanel">
        <a href="/submit-saas.html" class="nav-menu-primary">Submit your SaaS</a>
        <a href="/saas">Leaderboard</a>
        <div class="nav-menu-divider"></div>
        <a href="/#scan">How it works</a>
        <a href="/#metrics">Scoring</a>
        <a href="/#pricing">Pricing</a>
        <a href="/guide.html">Guide</a>
        <div class="nav-menu-divider"></div>
        <a href="/login.html">Sign in</a>
      </div>
    </div>
  </div>
</nav>
<main class="saas-main">
  <section class="saas-intro">
    <h1>The SaaS Leaderboard</h1>
    <p>Ranked by an independent notability score, not by who paid the most. Every product launched 2025 or later is welcome. Upvotes can move a listing from position 300 to position 1 &mdash; score just sets where it starts.</p>
    <p class="saas-stats">${total} SaaS ranked${category ? ` in ${escapeHtml(CATEGORIES.find((c) => c.value === category)?.label || category)}` : ''}</p>
    <a class="saas-cta" href="/submit-saas.html">Submit your SaaS &rarr;</a>
  </section>
  <div class="saas-filters">
    <div class="saas-filter-group">
      ${CATEGORIES.map((c) => {
        const active = c.value === (category || '');
        return `<a href="${qs(1, { category: c.value })}" class="saas-filter-pill${active ? ' active' : ''}">${escapeHtml(c.label)}</a>`;
      }).join('')}
    </div>
    <div class="saas-sort-group">
      <a href="${qs(1, { sort: 'top' })}" class="saas-sort-pill${sort === 'top' ? ' active' : ''}">Top Ranked</a>
      <a href="${qs(1, { sort: 'new' })}" class="saas-sort-pill${sort === 'new' ? ' active' : ''}">Newest</a>
    </div>
  </div>
  <ol class="saas-list">${rowsHtml}</ol>
  ${pagerHtml}

  <section class="saas-why">
    <h2>Why list on Kiver</h2>
    <div class="saas-why-grid">
      <div class="saas-why-item">
        <h3>No pay-to-play</h3>
        <p>Position comes from an independent notability score plus real upvotes &mdash; never a fee.</p>
      </div>
      <div class="saas-why-item">
        <h3>A real backlink</h3>
        <p>Every listing is a fully server-rendered, crawlable page with a genuine outbound link to your site.</p>
      </div>
      <div class="saas-why-item">
        <h3>Built for new SaaS</h3>
        <p>Open to anything launched 2025 or later &mdash; a fresh board, not a decade-old incumbent list.</p>
      </div>
    </div>
    <a class="saas-cta" href="/submit-saas.html">Submit your SaaS &rarr;</a>
  </section>
</main>
<footer>
  <div class="wrap">
    <p class="fnote">Kiver produces an independent, analytical score based on observable public signals. It is not affiliated with, endorsed by, or an official metric of Google, Meta, Instagram, OpenAI, Wikipedia, or any other platform.</p>
    <div class="frow">
      <span>&copy; 2026 Kiver</span>
      <div style="display:flex; gap:18px; flex-wrap:wrap;">
        <a href="/#metrics">Methodology</a>
        <a href="/guide.html">Guide</a>
        <a href="/privacy.html">Privacy</a>
        <a href="/terms.html">Terms</a>
        <a href="/refund.html">Refunds</a>
        <a href="mailto:support@getkiver.com">Support</a>
      </div>
    </div>
  </div>
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

  let domain = '';
  try { domain = new URL(listing.website_url).hostname.replace(/^www\./, ''); } catch {}

  const aboutText = listing.description
    || `${escapeHtml(listing.name)} is a${listing.category ? ` ${escapeHtml(listing.category)}` : ''} SaaS product${listing.launch_year ? `, launched in ${listing.launch_year}` : ''}. ${escapeHtml(listing.tagline || '')}`.trim();

  const bodyHtml = `
<nav>
  <div class="wrap">
    <div class="logo"><span class="mark"></span>Kiver</div>
    <div class="nav-menu">
      <button class="nav-menu-btn" id="navMenuBtn" type="button" aria-haspopup="true" aria-expanded="false">
        Menu
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="nav-menu-panel" id="navMenuPanel">
        <a href="/submit-saas.html" class="nav-menu-primary">Submit your SaaS</a>
        <a href="/saas">Leaderboard</a>
        <div class="nav-menu-divider"></div>
        <a href="/#scan">How it works</a>
        <a href="/#metrics">Scoring</a>
        <a href="/#pricing">Pricing</a>
        <a href="/guide.html">Guide</a>
        <div class="nav-menu-divider"></div>
        <a href="/login.html">Sign in</a>
      </div>
    </div>
  </div>
</nav>
<main class="saas-main saas-detail">
  <a class="saas-breadcrumb" href="/saas">&larr; All listings</a>
  <div class="saas-detail-top">
    ${position ? `<span class="saas-position-big">#${position}</span>` : ''}
    ${listing.logo_url ? `<img class="saas-logo saas-logo-big" src="${escapeHtml(listing.logo_url)}" alt="" onerror="this.style.visibility='hidden'">` : ''}
    <div>
      <h1>${escapeHtml(listing.name)}</h1>
      <p class="saas-tagline">${escapeHtml(listing.tagline || '')}</p>
      <div class="saas-meta-row">
        <span class="saas-tier saas-tier-${escapeHtml((listing.tier || 'new').toLowerCase())}">${listing.tier === 'Elite' ? '&#9733; ' : ''}${escapeHtml(listing.tier)}</span>
        ${listing.category ? `<span class="saas-category">${escapeHtml(listing.category)}</span>` : ''}
        ${listing.launch_year ? `<span class="saas-year">Launched ${listing.launch_year}</span>` : ''}
      </div>
      <div class="saas-score-block">
        <span class="saas-score-badge">${listing.base_score}% notability</span>
        <span class="saas-score-bar-wrap"><span class="saas-score-bar-fill" style="width:${listing.base_score}%"></span></span>
      </div>
    </div>
  </div>

  <h2 class="saas-about-heading">About ${escapeHtml(listing.name)}</h2>
  <p class="saas-description">${aboutText}</p>

  <div class="saas-detail-actions">
    <div>
      <a class="saas-visit" href="${escapeHtml(listing.website_url)}" target="_blank" rel="noopener">Visit ${escapeHtml(listing.name)} &#8599;</a>
      ${domain ? `<span class="saas-domain-caption">${escapeHtml(domain)}</span>` : ''}
    </div>
    <button class="saas-upvote saas-upvote-big" data-slug="${escapeHtml(listing.slug)}" aria-label="Upvote ${escapeHtml(listing.name)}">
      <span class="saas-upvote-arrow">&#9650;</span>
      <span class="saas-upvote-count">${listing.upvotes}</span>
    </button>
  </div>

  <p class="saas-fineprint">Notability score of ${listing.base_score}% set the entry point. Upvotes moved it the rest of the way &mdash; this position was earned, not bought.</p>
</main>
<footer>
  <div class="wrap">
    <p class="fnote">Kiver produces an independent, analytical score based on observable public signals. It is not affiliated with, endorsed by, or an official metric of Google, Meta, Instagram, OpenAI, Wikipedia, or any other platform.</p>
    <div class="frow">
      <span>&copy; 2026 Kiver</span>
      <div style="display:flex; gap:18px; flex-wrap:wrap;">
        <a href="/#metrics">Methodology</a>
        <a href="/guide.html">Guide</a>
        <a href="/privacy.html">Privacy</a>
        <a href="/terms.html">Terms</a>
        <a href="/refund.html">Refunds</a>
        <a href="mailto:support@getkiver.com">Support</a>
      </div>
    </div>
  </div>
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
