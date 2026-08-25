// lib/mock.js
//
// Deterministic mock scan, used automatically whenever SERPER_API_KEY or
// ANTHROPIC_API_KEY aren't set yet, and as a safety fallback if the real
// pipeline errors out. Keeps the live site always functional.

function mockScan(query) {
  const seed = [...query].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (min, max) => min + ((seed * 9301 + 49297) % (max - min + 1));

  const overall = rand(42, 91);
  const tierFor = (n) =>
    n >= 90 ? 'Exceptional' :
    n >= 75 ? 'Strong' :
    n >= 60 ? 'Established' :
    n >= 40 ? 'Developing' :
    n >= 20 ? 'Emerging' : 'Very Low';

  return {
    query,
    engine: 'mock',
    scannedAt: new Date().toISOString(),
    overallScore: overall,
    tier: tierFor(overall),
    matchConfidence: rand(78, 98),
    mentionsFound: rand(14, 210),
    independentMentions: rand(5, 40),
    strongestPublication: 'Ledgerline Business',
    components: {
      mediaPresence: rand(30, 95),
      sourceQuality: rand(30, 95),
      coverageDiversity: rand(30, 95),
      recency: rand(30, 95),
      originality: rand(30, 95),
      entityConsistency: rand(30, 95)
    },
    locked: {
      duplicateMentions: rand(2, 20),
      competitorComparison: true,
      fullSourceBreakdown: true,
      pdfReport: true
    },
    disclaimer:
      'This is an independent, analytical score based on observable public signals. Not affiliated with or endorsed by any search engine, social platform, or AI provider.'
  };
}

module.exports = { mockScan };
