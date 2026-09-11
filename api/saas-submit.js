// api/saas-submit.js — Vercel serverless function (Node.js runtime)
//
// Accepts a new SaaS submission, runs it through the same
// evidence-gathering + scoring pipeline that powers the rest of
// Notable (lib/search + lib/claude), and stores the result as a
// leaderboard listing. No submission ever pays for a better
// starting score — base_score comes only from the scan, and after
// that only upvotes move a listing (see lib/rank.js).

const { gatherEvidence } = require('../lib/search');
const { scoreEntity } = require('../lib/claude');
const { mockScan } = require('../lib/mock');
const { createSaasListing, getSaasListingByUrl } = require('../lib/db');
const { tierFor, clampScore } = require('../lib/rank');

const MIN_LAUNCH_YEAR = 2025;

function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const name = String(body.name || '').trim().slice(0, 120);
  const websiteUrl = String(body.websiteUrl || '').trim();
  const tagline = String(body.tagline || '').trim().slice(0, 160);
  const description = String(body.description || '').trim().slice(0, 2000);
  const category = String(body.category || '').trim().slice(0, 60) || null;
  const launchYear = parseInt(body.launchYear, 10);
  const submitterEmail = String(body.submitterEmail || '').trim().slice(0, 200) || null;

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
      engine
    });
    return res.status(201).json({ slug, baseScore, tier, url: `/saas/${slug}` });
  } catch (err) {
    console.error('Could not save listing:', err.message);
    return res.status(500).json({ error: 'Could not save your listing right now. Try again shortly.' });
  }
};
