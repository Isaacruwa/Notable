// api/saas-upvote.js — Vercel serverless function (Node.js runtime)
//
// One upvote per visitor per listing. Identity is an anonymous,
// httpOnly cookie id combined with a coarse hash of the request IP
// — enough to stop trivial refresh-spam without tracking anyone.

const crypto = require('crypto');
const { upvoteSaasListing } = require('../lib/db');

const VOTER_COOKIE = 'kiver_voter';

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

function getOrSetVoterId(req, res) {
  const cookies = parseCookies(req);
  let voterId = cookies[VOTER_COOKIE];
  if (!voterId) {
    voterId = crypto.randomBytes(16).toString('hex');
    res.setHeader(
      'Set-Cookie',
      `${VOTER_COOKIE}=${voterId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 365}`
    );
  }
  return voterId;
}

function voterHashFor(req, voterId) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return crypto.createHash('sha256').update(`${voterId}:${ip}`).digest('hex');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = String(req.body?.slug || '').trim();
  if (!slug) {
    return res.status(400).json({ error: 'Missing slug.' });
  }

  const voterId = getOrSetVoterId(req, res);
  const voterHash = voterHashFor(req, voterId);

  try {
    const result = await upvoteSaasListing(slug, voterHash);
    if (!result) {
      return res.status(404).json({ error: 'Listing not found.' });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error('Upvote failed:', err.message);
    return res.status(500).json({ error: 'Could not record your upvote right now.' });
  }
};
