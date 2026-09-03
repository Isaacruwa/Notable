// /api/admin-stats — real analytics for the admin dashboard
//
// Requires a logged-in session whose email is in ADMIN_EMAILS. Anyone else
// gets a flat 403 — no data leaks about what exists even in error shape.

const { getSessionEmail, isAdminEmail } = require('../lib/auth');
const { getAdminStats, listPremiumGrants } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = await getSessionEmail(req).catch(() => null);
  if (!email || !isAdminEmail(email)) {
    return res.status(403).json({ error: 'Not authorized.' });
  }

  try {
    const [stats, grants] = await Promise.all([getAdminStats(), listPremiumGrants()]);
    return res.status(200).json({ stats, grants });
  } catch (err) {
    console.error('Admin stats failed:', err.message);
    return res.status(500).json({ error: 'Could not load stats right now.' });
  }
};
