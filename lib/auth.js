// lib/auth.js
//
// Account and session helpers. Deliberately built without any extra
// dependency (no bcrypt, no JWT library) — Node's built-in crypto.scrypt is
// a genuinely secure password hash, and opaque server-side session tokens
// (stored in Postgres, see lib/db.js) are simpler and more revocable than
// JWTs for a project this size.
//
// Admin access is controlled by the ADMIN_EMAILS environment variable
// (comma-separated), not a database flag — this avoids the chicken-and-egg
// problem of needing an existing admin to grant the very first admin.

const crypto = require('crypto');
const { createSessionRecord, getSessionByToken, deleteSession } = require('./db');

const SESSION_COOKIE = 'kiver_session';
const SESSION_DAYS = 30;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
  } catch {
    return false;
  }
}

function isAdminEmail(email) {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(String(email).toLowerCase());
}

function parseCookies(req) {
  const header = req.headers?.cookie || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

async function createSession(res, email) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await createSessionRecord(token, email, expiresAt);
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
  );
  return token;
}

async function destroySession(req, res) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (token) {
    await deleteSession(token).catch(() => {});
  }
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

// Returns the logged-in email for this request, or null if not logged in
// / session expired / no session at all.
async function getSessionEmail(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = await getSessionByToken(token).catch(() => null);
  return session ? session.email : null;
}

module.exports = {
  hashPassword,
  verifyPassword,
  isAdminEmail,
  createSession,
  destroySession,
  getSessionEmail
};
