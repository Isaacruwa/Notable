// /api/scan — Vercel serverless function (Node.js runtime)
//
// Real pipeline: Serper.dev (search + news) -> Gemini (entity resolution,
// dedup detection, scoring) -> normalized response for the frontend.
//
// If SERPER_API_KEY or GEMINI_API_KEY aren't set, or if the real
// pipeline errors for any reason, this automatically falls back to a
// deterministic mock so the live site never breaks mid-scan.

const { gatherEvidence } = require('../lib/search');
const { scoreEntity } = require('../lib/claude');
const { mockScan } = require('../lib/mock');

function tierFor(n) {
  if (n >= 90) return 'Exceptional';
  if (n >= 75) return 'Strong';
  if (n >= 60) return 'Established';
  if (n >= 40) return 'Developing';
  if (n >= 20) return 'Emerging';
  return 'Very Low';
}

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

  const query = (req.method === 'POST' ? req.body?.query : req.query?.query) || '';

  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return res.status(400).json({ error: 'Provide a name, brand, or company to scan.' });
  }

  const trimmedQuery = query.trim().slice(0, 120);
  const hasKeys = process.env.SERPER_API_KEY && process.env.GEMINI_API_KEY;

  if (!hasKeys) {
    return res.status(200).json(mockScan(trimmedQuery));
  }

  try {
    const evidence = await gatherEvidence(trimmedQuery);
    const analysis = await scoreEntity(trimmedQuery, evidence);
    return res.status(200).json(normalizeResult(trimmedQuery, analysis));
  } catch (err) {
    console.error('Live scan pipeline failed, falling back to mock:', err.message);
    const fallback = mockScan(trimmedQuery);
    fallback.engine = 'mock-fallback';
    return res.status(200).json(fallback);
  }
};
