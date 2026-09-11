// api/saas-page.js — Vercel serverless function (Node.js runtime)
//
// Server-renders a single listing at /saas/:slug — full content on
// first load (title, description, score, a real outbound link) so
// it's genuinely crawlable and worth a backlink, not a JS shell.
//
// Routed here from a clean /saas/:slug URL via vercel.json
// rewrites (slug arrives as req.query.slug).

const { getSaasListingBySlug, getSaasListingPosition } = require('../lib/db');
const { escapeHtml, pageShell } = require('../lib/render');

const SITE = 'https://www.getkiver.com';

module.exports = async function handler(req, res) {
  const slug = String(req.query?.slug || '').trim();
  if (!slug) {
    return res.status(400).send('Missing slug.');
  }

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

  <p class="saas-fineprint">Notability score of ${listing.base_score}% set the entry point. Upvotes moved it the rest of the way — this position was earned, not bought.</p>
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
};
