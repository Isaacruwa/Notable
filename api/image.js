const db = require("../lib/db");

// Kiver bot logo proxy.
// Serves a bot's Telegram profile photo from our own domain so listings never show broken images.
// Order: fresh copy in this instance's memory -> live Telegram -> last good copy -> logo saved on the listing -> built-in fallback -> letter tile.

const UA = "Mozilla/5.0 KiverImageProxy/3.0";
const TRUSTED_IMAGE_HOST = /^https:\/\/([a-z0-9-]+\.)*(telesco\.pe|telegram\.org|t\.me)\//i;
const MEMORY_FRESH_MS = 6 * 60 * 60 * 1000;
const MEMORY_MAX = 80;
const memory = new Map();

const FALLBACK_IMAGES = {
  botfather:
    "https://cdn1.telesco.pe/file/dlMoubOmXmr2lyJLQE31w7FFLZG7adilSMyai_c9gvxWl2TihRajrQRk9x3S-JWGW8v8lTN3qA2ODePSKaBTjn6y4d57bM6zLxZGvZCUGiiXwILfmff5aryTx_bfSpM55BuuMH-OsUdiTsIig4UsjOFAEa6AUw0irbOvzyB2u6w5ZVyou0oE3BEPue26XSm26LgClFNWqiKeVAbuzUVTlcIUIq46D2OHkM678Tu0c34Iu4YMOYu--W9xpexXvfl9YW_db3zJkacpRtT1RNHVQAa1VYxbUbktAZNkUW197koIAC_21eGWhyVk_t-ge7aIFoBASxhrnCbsb6oLOVOTPg.jpg"
};

function decode(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCharCode(parseInt(x, 16)))
    .replace(/&#(\d+);/g, (_, x) => String.fromCharCode(Number(x)));
}

function metaImage(html) {
  // Regexes are created per call on purpose: a shared /g regex keeps its position between
  // requests, which made roughly every third lookup fail on a warm server.
  const metaRe = /<meta\b[^>]*>/gi;
  let match;
  while ((match = metaRe.exec(html))) {
    const attrs = {};
    const attrRe = /([\w:-]+)\s*=\s*(["'])(.*?)\2/gi;
    let attr;
    while ((attr = attrRe.exec(match[0]))) attrs[attr[1].toLowerCase()] = decode(attr[3]);
    const key = (attrs.property || attrs.name || "").toLowerCase();
    if ((key === "og:image" || key === "twitter:image" || key === "twitter:image:src") && attrs.content) {
      return attrs.content.trim();
    }
  }
  const photo = String(html).match(/<img[^>]*class=["'][^"']*tgme_page_photo_image[^"']*["'][^>]*\ssrc=["']([^"']+)["']/i);
  return photo ? decode(photo[1]).trim() : "";
}

function validUsername(value) {
  return /^[A-Za-z0-9_]{4,32}$/.test(String(value || ""));
}

async function fetchOk(url, accept, ms) {
  const response = await fetch(url, {
    headers: { "user-agent": UA, accept },
    signal: AbortSignal.timeout(Math.max(500, ms)),
    redirect: "follow"
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response;
}

async function loadImage(url, ms) {
  const response = await fetchOk(url, "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8", ms);
  const type = response.headers.get("content-type") || "";
  if (!/^image\//i.test(type) || /svg/i.test(type)) throw new Error("Not a bitmap image");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error("Bad image size");
  return { type, bytes };
}

async function liveImage(username, left) {
  for (let attempt = 0; attempt < 2 && left() > 1500; attempt++) {
    try {
      const page = await fetchOk(
        "https://t.me/" + encodeURIComponent(username),
        "text/html,application/xhtml+xml",
        Math.min(3500, left() - 800)
      );
      const src = metaImage(await page.text());
      if (!src) continue;
      return await loadImage(new URL(src, "https://t.me/").toString(), Math.min(4000, left()));
    } catch (_) {}
  }
  return null;
}

async function savedImage(username, left) {
  try {
    if (left() < 1500) return null;
    const row = await Promise.race([
      db.byUser(username),
      new Promise((resolve) => setTimeout(() => resolve(null), 3000))
    ]);
    const url = row && (row.image_url || row.imageUrl);
    if (url && TRUSTED_IMAGE_HOST.test(url)) return await loadImage(url, Math.min(3500, left()));
  } catch (_) {}
  return null;
}

function remember(key, image) {
  memory.delete(key);
  memory.set(key, { type: image.type, bytes: image.bytes, at: Date.now() });
  while (memory.size > MEMORY_MAX) memory.delete(memory.keys().next().value);
}

function letterTile(username) {
  const letter = (String(username).replace(/[^A-Za-z0-9]/g, "")[0] || "K").toUpperCase();
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160" role="img" aria-label="' + letter + '">' +
    '<rect width="160" height="160" fill="#f1f0ec"/>' +
    '<text x="80" y="80" text-anchor="middle" dominant-baseline="central" font-family="Arial,Helvetica,sans-serif" font-size="72" font-weight="700" fill="#171717">' + letter + "</text></svg>"
  );
}

module.exports = async (req, res) => {
  const username = String(req.query.u || "").replace(/^@/, "").trim();
  if (!validUsername(username)) return res.status(400).end("Invalid bot username");

  const started = Date.now();
  const left = () => 8000 - (Date.now() - started);
  const key = username.toLowerCase();
  const cached = memory.get(key);

  let image = null;
  let source = "";

  if (cached && Date.now() - cached.at < MEMORY_FRESH_MS) {
    image = cached;
    source = "memory";
  }
  if (!image) {
    image = await liveImage(username, left);
    if (image) {
      source = "telegram";
      remember(key, image);
    }
  }
  if (!image && cached) {
    image = cached;
    source = "last-good";
  }
  if (!image) {
    image = await savedImage(username, left);
    if (image) {
      source = "saved";
      remember(key, image);
    }
  }
  if (!image && FALLBACK_IMAGES[key] && left() > 1000) {
    try {
      image = await loadImage(FALLBACK_IMAGES[key], Math.min(4000, left()));
      source = "fallback";
    } catch (_) {}
  }

  res.setHeader("X-Content-Type-Options", "nosniff");

  if (image) {
    const fresh = source === "telegram" || source === "memory";
    res.setHeader("Content-Type", image.type);
    res.setHeader(
      "Cache-Control",
      fresh
        ? "public, max-age=86400, s-maxage=604800, stale-while-revalidate=31536000, stale-if-error=31536000"
        : "public, max-age=600, s-maxage=600, stale-while-revalidate=86400"
    );
    res.setHeader("X-Logo-Source", source);
    return res.end(image.bytes);
  }

  // Never return a broken image: show a clean letter tile and retry soon.
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
  res.setHeader("X-Logo-Source", "letter-tile");
  return res.end(letterTile(username));
};
