// /api/signup — create an account (email + password)

const { createUser } = require('../lib/db');
const { hashPassword, createSession, isAdminEmail } = require('../lib/auth');

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const passwordHash = hashPassword(password);
    const user = await createUser(email, passwordHash);
    if (!user) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    await createSession(res, email);
    return res.status(200).json({ email, isAdmin: isAdminEmail(email) });
  } catch (err) {
    console.error('Signup failed:', err.message);
    return res.status(500).json({ error: 'Could not create your account right now. Try again shortly.' });
  }
};
