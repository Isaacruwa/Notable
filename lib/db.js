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

module.exports = { saveScan, getScanBySlug };
