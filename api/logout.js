// /api/logout — end the current session

const { destroySession } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  await destroySession(req, res);
  return res.status(200).json({ loggedOut: true });
};
