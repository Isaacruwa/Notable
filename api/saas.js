// api/saas.js — Vercel serverless function (Node.js runtime)
//
// Combined JSON endpoint for the SaaS Leaderboard: submission,
// upvoting, and the leaderboard feed all live in one file (instead
// of three) to stay under this project's serverless function cap.
//
// POST { action: 'submit', ...fields }  -> create a listing
// POST { action: 'upvote', slug }       -> upvote a listing
// GET  ?category=&limit=&offset=        -> leaderboard JSON

const crypto = require('crypto');
const { gatherEvidence } = require('../lib/search');
const { scoreEntity } = require('../lib/claude');
const { mockScan } = require('../lib/mock');
const {
  createSaasListing,
  getSaasListingByUrl,
  upvoteSaasListing,
  listSaasLeaderboard,
  countSaasListings
} = require('../lib/db');
const { tierFor, clampScore } = require('../lib/rank');

const MIN_LAUNCH_YEAR = 2025;
const VOTER_COOKIE = 'kiver_voter';

function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Logo is a must-have on every listing. If the submitter didn't give
// one directly, pull the site's favicon as a real logo image rather
// than leaving the listing generic.
function faviconFor(websiteUrl) {
  try {
    const domain = new URL(websiteUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers?.cookie || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function getOrSetVoterId(req, res) {
  const cookies = parseCookies(req);
  let voterId = cookies[VOTER_COOKIE];
  if (!voterId) {
    voterId = crypto.randomBytes(16).toString('hex');
    res.setHeader(
      'Set-Cookie',
      `${VOTER_COOKIE}=${voterId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 365}`
    );
  }
  return voterId;
}

function voterHashFor(req, voterId) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return crypto.createHash('sha256').update(`${voterId}:${ip}`).digest('hex');
}

async function handleSubmit(req, res) {
  const body = req.body || {};
  const name = String(body.name || '').trim().slice(0, 120);
  const websiteUrl = String(body.websiteUrl || '').trim();
  const tagline = String(body.tagline || '').trim().slice(0, 160);
  const description = String(body.description || '').trim().slice(0, 2000);
  const category = String(body.category || '').trim().slice(0, 60) || null;
  const launchYear = parseInt(body.launchYear, 10);
  const submitterEmail = String(body.submitterEmail || '').trim().slice(0, 200) || null;
  const submittedLogoUrl = String(body.logoUrl || '').trim();

  if (!name || name.length < 2) {
    return res.status(400).json({ error: 'Give your SaaS a name.' });
  }
  if (!isValidUrl(websiteUrl)) {
    return res.status(400).json({ error: 'Provide a valid product URL (https://...).' });
  }
  if (!launchYear || launchYear < MIN_LAUNCH_YEAR) {
    return res.status(400).json({
      error: `This leaderboard is for new SaaS only — launch year ${MIN_LAUNCH_YEAR} or later.`
    });
  }

  try {
    const existing = await getSaasListingByUrl(websiteUrl);
    if (existing) {
      return res.status(409).json({
        error: 'This product is already listed.',
        slug: existing.slug,
        url: `/saas/${existing.slug}`
      });
    }
  } catch (err) {
    console.error('Duplicate check failed (continuing):', err.message);
  }

  const scanQuery = `${name} ${websiteUrl}`.trim().slice(0, 120);
  const hasKeys = process.env.SERPER_API_KEY && process.env.GEMINI_API_KEY;

  let baseScore;
  let engine;
  if (!hasKeys) {
    baseScore = clampScore(mockScan(scanQuery).overallScore);
    engine = 'mock';
  } else {
    try {
      const evidence = await gatherEvidence(scanQuery);
      const analysis = await scoreEntity(scanQuery, evidence);
      baseScore = clampScore(analysis.overallScore);
      engine = 'live';
    } catch (err) {
      console.error('Live scoring failed, falling back to mock:', err.message);
      baseScore = clampScore(mockScan(scanQuery).overallScore);
      engine = 'mock-fallback';
    }
  }

  const tier = tierFor(baseScore);
  const logoUrl = (isValidUrl(submittedLogoUrl) && submittedLogoUrl) || faviconFor(websiteUrl);

  try {
    const slug = await createSaasListing({
      name,
      tagline,
      description,
      websiteUrl,
      category,
      launchYear,
      submitterEmail,
      baseScore,
      tier,
      engine,
      logoUrl
    });
    return res.status(201).json({ slug, baseScore, tier, url: `/saas/${slug}` });
  } catch (err) {
    console.error('Could not save listing:', err.message);
    return res.status(500).json({ error: 'Could not save your listing right now. Try again shortly.' });
  }
}

async function handleUpvote(req, res) {
  const slug = String(req.body?.slug || '').trim();
  if (!slug) {
    return res.status(400).json({ error: 'Missing slug.' });
  }
  const voterId = getOrSetVoterId(req, res);
  const voterHash = voterHashFor(req, voterId);
  try {
    const result = await upvoteSaasListing(slug, voterHash);
    if (!result) {
      return res.status(404).json({ error: 'Listing not found.' });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error('Upvote failed:', err.message);
    return res.status(500).json({ error: 'Could not record your upvote right now.' });
  }
}

async function handleLeaderboard(req, res) {
  const category = req.query?.category ? String(req.query.category) : undefined;
  const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query?.offset, 10) || 0);

  try {
    const [rows, total] = await Promise.all([
      listSaasLeaderboard({ category, limit, offset }),
      countSaasListings(category)
    ]);
    const listings = rows.map((r, i) => ({
      position: offset + i + 1,
      slug: r.slug,
      name: r.name,
      tagline: r.tagline,
      websiteUrl: r.website_url,
      category: r.category,
      launchYear: r.launch_year,
      baseScore: r.base_score,
      tier: r.tier,
      upvotes: r.upvotes,
      logoUrl: r.logo_url,
      rankScore: Math.round(Number(r.rank_score) * 10) / 10
    }));
    return res.status(200).json({ listings, total, limit, offset });
  } catch (err) {
    console.error('Leaderboard fetch failed:', err.message);
    return res.status(500).json({ error: 'Could not load the leaderboard right now.' });
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return handleLeaderboard(req, res);
  }
  if (req.method === 'POST') {
    const action = req.body?.action;
    if (action === 'submit') return handleSubmit(req, res);
    if (action === 'upvote') return handleUpvote(req, res);
    return res.status(400).json({ error: 'Unknown action.' });
  }
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
};
