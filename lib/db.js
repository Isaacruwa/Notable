// lib/db.js
//
// Thin wrapper around Neon's serverless Postgres driver. Used to persist
// every scan result so it survives a page refresh and can be reopened later
// via a permanent, shareable link.
//
// Requires DATABASE_URL in the environment — this was added automatically
// when the Neon integration was installed from the Vercel Storage tab.
//
// If DATABASE_URL isn't set, or the database is briefly unreachable, saving
// and lookups simply fail quietly — the scan itself still works, it just
// won't be persisted or shareable that time. A scan is never blocked by a
// database problem.

const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

let sql = null;
function getClient() {
  if (!sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  const client = getClient();
  await client`
    CREATE TABLE IF NOT EXISTS scans (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      query TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  tableReady = true;
}

function slugify(str) {
  return (
    str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'entity'
  );
}

// Saves a scan result and returns a short, URL-safe slug for it.
// Never throws to the caller in a way that should block the scan response —
// callers should wrap this in try/catch and treat failure as "no share link
// this time," not as a reason to fail the whole request.
async function saveScan(query, data) {
  await ensureTable();
  const client = getClient();
  const slug = `${slugify(query)}-${crypto.randomBytes(4).toString('hex')}`;
  await client`
    INSERT INTO scans (slug, query, data)
    VALUES (${slug}, ${query}, ${JSON.stringify(data)})
  `;
  return slug;
}

// Looks up a previously saved scan by its slug. Returns null if not found.
async function getScanBySlug(slug) {
  await ensureTable();
  const client = getClient();
  const rows = await client`SELECT data FROM scans WHERE slug = ${slug} LIMIT 1`;
  if (!rows || rows.length === 0) return null;
  return rows[0].data;
}

// ---------------------------------------------------------------------
// Purchases — one-time Complete Report unlocks, tied to a specific scan
// slug. Recorded only after Paddle confirms payment via a verified webhook.
// ---------------------------------------------------------------------
let purchasesTableReady = false;
async function ensurePurchasesTable() {
  if (purchasesTableReady) return;
  const client = getClient();
  await client`
    CREATE TABLE IF NOT EXISTS purchases (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      transaction_id TEXT,
      price_id TEXT,
      customer_email TEXT,
      paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  purchasesTableReady = true;
}

async function markSlugPaid(slug, { transactionId, priceId, customerEmail } = {}) {
  await ensurePurchasesTable();
  const client = getClient();
  await client`
    INSERT INTO purchases (slug, transaction_id, price_id, customer_email)
    VALUES (${slug}, ${transactionId || null}, ${priceId || null}, ${customerEmail || null})
    ON CONFLICT (slug) DO UPDATE SET
      transaction_id = EXCLUDED.transaction_id,
      price_id = EXCLUDED.price_id,
      customer_email = EXCLUDED.customer_email,
      paid_at = now()
  `;
}

async function isSlugPaid(slug) {
  await ensurePurchasesTable();
  const client = getClient();
  const rows = await client`SELECT 1 FROM purchases WHERE slug = ${slug} LIMIT 1`;
  return rows.length > 0;
}

// ---------------------------------------------------------------------
// Subscriptions — Monitor / Agency recurring plans. Basic status tracking
// keyed by Paddle's subscription id, recorded via verified webhook events.
// ---------------------------------------------------------------------
let subscriptionsTableReady = false;
async function ensureSubscriptionsTable() {
  if (subscriptionsTableReady) return;
  const client = getClient();
  await client`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      subscription_id TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL,
      price_id TEXT,
      customer_email TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  subscriptionsTableReady = true;
}

async function recordSubscriptionEvent({ subscriptionId, status, priceId, customerEmail }) {
  await ensureSubscriptionsTable();
  const client = getClient();
  await client`
    INSERT INTO subscriptions (subscription_id, status, price_id, customer_email)
    VALUES (${subscriptionId}, ${status}, ${priceId || null}, ${customerEmail || null})
    ON CONFLICT (subscription_id) DO UPDATE SET
      status = EXCLUDED.status,
      price_id = EXCLUDED.price_id,
      customer_email = EXCLUDED.customer_email,
      updated_at = now()
  `;
}

// ---------------------------------------------------------------------
// Users — email/password accounts. Needed so subscribers can eventually
// manage their own auto-renewing plans, and so admin access + free
// premium grants can be tied to a real identity rather than a slug.
// ---------------------------------------------------------------------
let usersTableReady = false;
async function ensureUsersTable() {
  if (usersTableReady) return;
  const client = getClient();
  await client`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  usersTableReady = true;
}

async function createUser(email, passwordHash) {
  await ensureUsersTable();
  const client = getClient();
  const rows = await client`
    INSERT INTO users (email, password_hash)
    VALUES (${email}, ${passwordHash})
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email
  `;
  return rows[0] || null; // null means the email was already taken
}

async function getUserByEmail(email) {
  await ensureUsersTable();
  const client = getClient();
  const rows = await client`SELECT id, email, password_hash FROM users WHERE email = ${email} LIMIT 1`;
  return rows[0] || null;
}

// ---------------------------------------------------------------------
// Sessions — opaque random tokens stored server-side (not JWTs), so a
// session can be instantly revoked by deleting its row. The token itself
// lives in an httpOnly cookie (see lib/auth.js).
// ---------------------------------------------------------------------
let sessionsTableReady = false;
async function ensureSessionsTable() {
  if (sessionsTableReady) return;
  const client = getClient();
  await client`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  sessionsTableReady = true;
}

async function createSessionRecord(token, email, expiresAt) {
  await ensureSessionsTable();
  const client = getClient();
  await client`INSERT INTO sessions (token, email, expires_at) VALUES (${token}, ${email}, ${expiresAt})`;
}

async function getSessionByToken(token) {
  await ensureSessionsTable();
  const client = getClient();
  const rows = await client`
    SELECT email, expires_at FROM sessions WHERE token = ${token} LIMIT 1
  `;
  if (!rows[0]) return null;
  if (new Date(rows[0].expires_at) < new Date()) return null; // expired
  return rows[0];
}

async function deleteSession(token) {
  await ensureSessionsTable();
  const client = getClient();
  await client`DELETE FROM sessions WHERE token = ${token}`;
}

// ---------------------------------------------------------------------
// Premium grants — admin-issued free access, by email. An admin can mark
// their own (or any) email as permanently comped, bypassing the normal
// per-report payment check everywhere access is gated.
// ---------------------------------------------------------------------
let grantsTableReady = false;
async function ensureGrantsTable() {
  if (grantsTableReady) return;
  const client = getClient();
  await client`
    CREATE TABLE IF NOT EXISTS premium_grants (
      email TEXT PRIMARY KEY,
      granted_by TEXT,
      note TEXT,
      granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  grantsTableReady = true;
}

async function grantPremium(email, grantedBy, note) {
  await ensureGrantsTable();
  const client = getClient();
  await client`
    INSERT INTO premium_grants (email, granted_by, note)
    VALUES (${email}, ${grantedBy || null}, ${note || null})
    ON CONFLICT (email) DO UPDATE SET granted_by = EXCLUDED.granted_by, note = EXCLUDED.note
  `;
}

async function revokePremium(email) {
  await ensureGrantsTable();
  const client = getClient();
  await client`DELETE FROM premium_grants WHERE email = ${email}`;
}

async function hasPremiumGrant(email) {
  if (!email) return false;
  await ensureGrantsTable();
  const client = getClient();
  const rows = await client`SELECT 1 FROM premium_grants WHERE email = ${email} LIMIT 1`;
  return rows.length > 0;
}

async function listPremiumGrants() {
  await ensureGrantsTable();
  const client = getClient();
  return client`SELECT email, granted_by, note, granted_at FROM premium_grants ORDER BY granted_at DESC`;
}

// ---------------------------------------------------------------------
// Admin analytics — simple aggregate counts across everything above.
// ---------------------------------------------------------------------
async function getAdminStats() {
  await Promise.all([
    ensureTable(),
    ensureUsersTable(),
    ensurePurchasesTable(),
    ensureSubscriptionsTable(),
    ensureGrantsTable()
  ]);
  const client = getClient();

  const [users, scans, purchases, activeSubs, canceledSubs, grants] = await Promise.all([
    client`SELECT COUNT(*)::int AS n FROM users`,
    client`SELECT COUNT(*)::int AS n FROM scans`,
    client`SELECT COUNT(*)::int AS n FROM purchases`,
    client`SELECT COUNT(*)::int AS n FROM subscriptions WHERE status = 'active'`,
    client`SELECT COUNT(*)::int AS n FROM subscriptions WHERE status = 'canceled'`,
    client`SELECT COUNT(*)::int AS n FROM premium_grants`
  ]);

  return {
    totalUsers: users[0].n,
    totalScans: scans[0].n,
    paidReports: purchases[0].n,
    activeSubscriptions: activeSubs[0].n,
    canceledSubscriptions: canceledSubs[0].n,
    premiumGrants: grants[0].n
  };
}

module.exports = {
  saveScan,
  getScanBySlug,
  markSlugPaid,
  isSlugPaid,
  recordSubscriptionEvent,
  createUser,
  getUserByEmail,
  createSessionRecord,
  getSessionByToken,
  deleteSession,
  grantPremium,
  revokePremium,
  hasPremiumGrant,
  listPremiumGrants,
  getAdminStats
};
