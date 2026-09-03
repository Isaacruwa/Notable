// /api/me — who's currently logged in, if anyone

const { getSessionEmail, isAdminEmail } = require('../lib/auth');
const { hasPremiumGrant } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = await getSessionEmail(req).catch(() => null);
  if (!email) {
    return res.status(200).json({ loggedIn: false });
  }

  const premium = await hasPremiumGrant(email).catch(() => false);
  return res.status(200).json({
    loggedIn: true,
    email,
    isAdmin: isAdminEmail(email),
    hasPremium: premium
  });
};
