// lib/rank.js
//
// Turns a listing's base notability score (0-100, produced by the
// same scan engine that powers the rest of Notable) plus its
// upvote count into a single position on the SaaS leaderboard.
//
// Design:
// - baseScore is the entry point. It's what determines a listing's
//   starting tier badge (Elite / Strong / Rising / New).
// - Upvotes are the only thing that moves the actual leaderboard
//   position after that. The bump uses log2 so early votes count
//   for a lot and it never fully plateaus — a listing with enough
//   real community pull can climb from page 12 to #1. That's the
//   whole point of the feature: you can't buy a spot, but you can
//   earn one.
//
// Nobody pays to rank higher. This file is the only thing that
// decides position — keep it that way.

const TIERS = [
  { name: 'Elite', min: 85 },
  { name: 'Strong', min: 70 },
  { name: 'Rising', min: 50 },
  { name: 'New', min: 0 }
];

// Each doubling of upvotes is worth ~12 points. 100 genuine
// upvotes (~+80) is enough on its own to out-rank a fresh 0-score
// listing against anything below "Strong" (~70), and 300+ upvotes
// can out-muscle even an Elite-tier score. Tune UPVOTE_WEIGHT if
// that balance feels off once real traffic hits it.
const UPVOTE_WEIGHT = 12;

function clampScore(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function tierFor(baseScore) {
  const s = clampScore(baseScore);
  return TIERS.find((t) => s >= t.min).name;
}

// The number a listing is actually sorted by. baseScore sets where
// it starts; upvotes are the only way to move from there.
function rankScore(baseScore, upvotes) {
  const votes = Math.max(0, Number(upvotes) || 0);
  return clampScore(baseScore) + Math.log2(votes + 1) * UPVOTE_WEIGHT;
}

module.exports = { tierFor, clampScore, rankScore, TIERS, UPVOTE_WEIGHT };
