// lib/render.js
//
// Tiny shared HTML helpers for the server-rendered SaaS leaderboard
// pages (api/saas-index.js, api/saas-page.js). No templating engine
// — just escaping plus a shared page shell, matching how the rest
// of this repo avoids extra dependencies.

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function pageShell({ title, description, canonical, ogImage, jsonLd, bodyHtml, extraHead = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:type" content="website">
${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/css/saas.css">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
${extraHead}
</head>
<body>
${bodyHtml}
<script src="/js/saas.js" defer></script>
</body>
</html>`;
}

module.exports = { escapeHtml, pageShell };
