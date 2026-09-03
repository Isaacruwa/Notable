// /api/login — sign in with email + password

const { getUserByEmail } = require('../lib/db');
const { verifyPassword, createSession, isAdminEmail } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Enter your email and password.' });
  }

  try {
    const user = await getUserByEmail(email);
    // Deliberately identical error for "no such account" and "wrong
    // password" — doesn't leak which emails have an account.
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    await createSession(res, email);
    return res.status(200).json({ email, isAdmin: isAdminEmail(email) });
  } catch (err) {
    console.error('Login failed:', err.message);
    return res.status(500).json({ error: 'Could not sign you in right now. Try again shortly.' });
  }
};
