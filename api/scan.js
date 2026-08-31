// /api/scan — Vercel serverless function (Node.js runtime)
//
// Real pipeline: Serper.dev (search + news) -> Gemini (entity resolution,
// dedup detection, scoring) -> normalized response for the frontend.
// Every result (real or mock) is saved to Postgres so it survives a refresh
// and can be reopened later via a permanent, shareable link
// (?s=<slug> on the homepage).
//
// If SERPER_API_KEY or GEMINI_API_KEY aren't set, or if the real pipeline
// errors for any reason, this automatically falls back to a deterministic
// mock so the live site never breaks mid-scan. Likewise, if the database
// is unreachable, the scan still returns normally — it just won't get a
// share link that time.

const { gatherEvidence } = require('../lib/search');
const { scoreEntity } = require('../lib/claude');
const { mockScan } = require('../lib/mock');
const { saveScan, getScanBySlug, isSlugPaid } = require('../lib/db');

function tierFor(n) {
  if (n >= 90) return 'Exceptional';
  if (n >= 75) return 'Strong';
  if (n >= 60) return 'Established';
  if (n >= 40) return 'Developing';
  if (n >= 20) return 'Emerging';
  return 'Very Low';
}

// Maps Gemini's raw analysis into the stable contract the frontend expects,
// plus a few extra fields (sources, topGaps, notes) for future report UI.
function normalizeResult(query, analysis) {
  return {
    query,
    engine: 'live',
    scannedAt: new Date().toISOString(),
    entityConfirmed: !!analysis.entityConfirmed,
    overallScore: clamp(analysis.overallScore),
    tier: analysis.tier || tierFor(clamp(analysis.overallScore)),
    matchConfidence: clamp(analysis.matchConfidence),
    mentionsFound: analysis.mentionsFound ?? 0,
    independentMentions: analysis.independentMentions ?? 0,
    strongestPublication: analysis.strongestPublication || null,
    components: {
      mediaPresence: clamp(analysis.components?.mediaPresence),
      sourceQuality: clamp(analysis.components?.sourceQuality),
      coverageDiversity: clamp(analysis.components?.coverageDiversity),
      recency: clamp(analysis.components?.recency),
      originality: clamp(analysis.components?.originality),
      entityConsistency: clamp(analysis.components?.entityConsistency)
    },
    locked: {
      duplicateMentions: analysis.duplicateMentions ?? 0,
      competitorComparison: true,
      fullSourceBreakdown: true,
      pdfReport: true
    },
    topGaps: analysis.topGaps || [],
    sources: analysis.sources || [],
    notes: analysis.notes || '',
    disclaimer:
      'This is an independent, analytical score based on observable public signals. Not affiliated with or endorsed by any search engine, social platform, or AI provider.'
  };
}

function clamp(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ---- Shared-link lookup: GET /api/scan?slug=xxxx ----
  // Returns a previously saved scan exactly as it was, instead of running
  // a new one. This is what makes "Share my score" links actually work.
  if (req.method === 'GET' && req.query?.slug) {
    try {
      const saved = await getScanBySlug(String(req.query.slug));
      if (!saved) {
        return res.status(404).json({ error: 'No saved scan found for this link.' });
      }
      const paid = await isSlugPaid(String(req.query.slug)).catch(() => false);
      return res.status(200).json({ ...saved, paid });
    } catch (err) {
      console.error('Scan lookup failed:', err.message);
      return res.status(500).json({ error: 'Could not load that saved scan right now.' });
    }
  }

  const query = (req.method === 'POST' ? req.body?.query : req.query?.query) || '';

  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return res.status(400).json({ error: 'Provide a name, brand, or company to scan.' });
  }

  const trimmedQuery = query.trim().slice(0, 120);
  const hasKeys = process.env.SERPER_API_KEY && process.env.GEMINI_API_KEY;

  let result;
  if (!hasKeys) {
    result = mockScan(trimmedQuery);
  } else {
    try {
      const evidence = await gatherEvidence(trimmedQuery);
      const analysis = await scoreEntity(trimmedQuery, evidence);
      result = normalizeResult(trimmedQuery, analysis);
    } catch (err) {
      console.error('Live scan pipeline failed, falling back to mock:', err.message);
      result = mockScan(trimmedQuery);
      result.engine = 'mock-fallback';
    }
  }

  // Persist the result so it survives a refresh and can be shared as a
  // permanent link. A database problem never blocks the scan itself —
  // it just means this particular result won't have a share link.
  try {
    result.shareSlug = await saveScan(trimmedQuery, result);
  } catch (err) {
    console.error('Saving scan to database failed (scan still returned normally):', err.message);
  }

  return res.status(200).json(result);
};
