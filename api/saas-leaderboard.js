// api/saas-leaderboard.js — Vercel serverless function (Node.js runtime)
//
// JSON leaderboard feed. The first page crawlers and visitors see
// is server-rendered (api/saas-index.js); this endpoint backs
// client-side filtering/pagination on top of that.

const { listSaasLeaderboard, countSaasListings } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
      rankScore: Math.round(Number(r.rank_score) * 10) / 10
    }));
    return res.status(200).json({ listings, total, limit, offset });
  } catch (err) {
    console.error('Leaderboard fetch failed:', err.message);
    return res.status(500).json({ error: 'Could not load the leaderboard right now.' });
  }
};
