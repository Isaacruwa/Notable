const META = /<meta\\b[^>]*>/gi;

function decode(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCharCode(parseInt(x, 16)))
    .replace(/&#(\\d+);/g, (_, x) => String.fromCharCode(Number(x)));
}

function metaImage(html) {
  let match;
  while ((match = META.exec(html))) {
    const attrs = {};
    let attr;
    const attrRe = /([\\w:-]+)\\s*=([\"'])(.*?)\\2/gi;
    while ((attr = attrRe.exec(match[0]))) {
      attrs[attr[1].toLowerCase()] = decode(attr[3]);
    }
    const key = (attrs.property || attrs.name || "").toLowerCase();
    if (
      (key === "og:image" ||
        key === "twitter:image" ||
        key === "twitter:image:src") &&
      attrs.content
    ) {
      return attrs.content.trim();
    }
  }
  return "";
}

function validUsername(value) {
  return /^[A-Za-z0-9_]{5,32}$/.test(String(value || ""));
}

// BotFather's official public Telegram page currently exposes its profile
// image through Telegram's CDN. Keep this as a last-resort fallback so the
// official listing does not break if Telegram's page metadata is temporarily
// unavailable or changes shape.
const FALLBACK_IMAGES = {
  botfather:
    "https://cdn1.telesco.pe/file/dlMoubOmXmr2lyJLQE31w7FFLZG7adilSMyai_c9gvxWl2TihRajrQRk9x3S-JWGW8v8lTN3qA2ODePSKaBTjn6y4d57bM6zLxZGvZCUGiiXwILfmff5aryTx_bfSpM55BuuMH-OsUdiTsIig4UsjOFAEa6AUw0irbOvzyB2u6w5ZVyou0oE3BEPue26XSm26LgClFNWqiKeVAbuzUVTlcIUIq46D2OHkM678Tu0c34Iu4YMOYu--W9xpexXvfl9YW_db3zJkacpRtT1RNHVQAa1VYxbUbktAZNkUW197koIAC_21eGWhyVk_t-ge7aIFoBASxhrnCbsb6oLOVOTPg.jpg"
};

async function fetchImage(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 KiverImageProxy/2.0",
      accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8"
    }
  });
  if (!response.ok) throw new Error("Image fetch failed");
  return response;
}

module.exports = async (req, res) => {
  const username = String(req.query.u || "").replace(/^@/, "").trim();

  if (!validUsername(username)) {
    return res.status(400).end("Invalid bot username");
  }

  const fallbackUrl = FALLBACK_IMAGES[username.toLowerCase()];

  try {
    let imageUrl = "";

    try {
      const page = await fetch(
        "https://t.me/" + encodeURIComponent(username),
        {
          headers: {
            "user-agent": "Mozilla/5.0 KiverImageProxy/2.0",
            accept: "text/html,application/xhtml+xml"
          }
        }
      );

      if (page.ok) {
        imageUrl = metaImage(await page.text());
      }
    } catch (_) {
      // Use the known fallback below when Telegram's public page is unavailable.
    }

    if (!imageUrl) imageUrl = fallbackUrl;
    if (!imageUrl) return res.status(404).end("Bot image unavailable");

    const absolute = new URL(imageUrl, "https://t.me/").toString();

    let image;
    try {
      image = await fetchImage(absolute);
    } catch (_) {
      if (!fallbackUrl || absolute === fallbackUrl) {
        return res.status(502).end("Bot image unavailable");
      }
      image = await fetchImage(fallbackUrl);
    }

    const type = image.headers.get("content-type") || "image/jpeg";
    if (!/^image\\//i.test(type)) {
      return res.status(502).end("Invalid bot image");
    }

    const bytes = Buffer.from(await image.arrayBuffer());

    if (bytes.length > 8 * 1024 * 1024) {
      return res.status(413).end("Bot image too large");
    }

    res.setHeader("Content-Type", type);
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=86400, stale-while-revalidate=31536000"
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.end(bytes);
  } catch (_) {
    return res.status(502).end("Bot image unavailable");
  }
};
