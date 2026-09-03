// /api/admin-grant — grant or revoke free premium access for an email
//
// Requires a logged-in session whose email is in ADMIN_EMAILS.

const { getSessionEmail, isAdminEmail } = require('../lib/auth');
const { grantPremium, revokePremium } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const adminEmail = await getSessionEmail(req).catch(() => null);
  if (!adminEmail || !isAdminEmail(adminEmail)) {
    return res.status(403).json({ error: 'Not authorized.' });
  }

  const targetEmail = String(req.body?.email || '').trim().toLowerCase();
  const action = req.body?.action === 'revoke' ? 'revoke' : 'grant';
  const note = req.body?.note ? String(req.body.note).slice(0, 200) : null;

  if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  try {
    if (action === 'revoke') {
      await revokePremium(targetEmail);
    } else {
      await grantPremium(targetEmail, adminEmail, note);
    }
    return res.status(200).json({ email: targetEmail, action });
  } catch (err) {
    console.error('Admin grant/revoke failed:', err.message);
    return res.status(500).json({ error: 'Could not update that grant right now.' });
  }
};
