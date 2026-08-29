// lib/search.js
//
// Thin client for Serper.dev (Google Search API). Used to pull real web and
// news results for an entity before handing them to Claude for scoring.
//
// Requires SERPER_API_KEY in the environment. Get a key at https://serper.dev
// (free tier includes trial credits — no card required to start).

const SERPER_BASE = 'https://google.serper.dev';

async function serperRequest(endpoint, query) {
  const res = await fetch(`${SERPER_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ q: query, num: 20 })
  });

  if (!res.ok) {
    throw new Error(`Serper ${endpoint} request failed: ${res.status}`);
  }
  return res.json();
}

// Normalizes web + news results into one flat evidence list Claude can
// reason over. Every item keeps its raw source so nothing is fabricated
// downstream — Claude is only allowed to describe what's here.
function normalize(items, type) {
  return (items || []).map((item) => ({
    type,
    title: item.title || null,
    url: item.link || null,
    snippet: item.snippet || null,
    source: item.source || (item.link ? safeHostname(item.link) : null),
    date: item.date || null
  }));
}

function safeHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function gatherEvidence(query) {
  const [webRes, newsRes] = await Promise.all([
    serperRequest('search', query),
    serperRequest('news', query)
  ]);

  const web = normalize(webRes.organic, 'web');
  const news = normalize(newsRes.news, 'news');

  // De-duplicate by URL before this even reaches Claude — cheap, exact-match
  // dedup here; Claude handles the harder near-duplicate/syndication case.
  const seen = new Set();
  const combined = [...news, ...web].filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  return combined;
}

module.exports = { gatherEvidence };
