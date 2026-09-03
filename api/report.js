// /api/report — Vercel serverless function (Node.js runtime)
//
// Generates the Complete Notability Report as a downloadable PDF from a
// previously saved scan (see lib/db.js).
//
//   GET /api/report?slug=<shareSlug>
//
// Uses pdfkit — a pure-JS PDF generator with no headless-browser dependency,
// so it runs reliably in a lightweight serverless function without needing
// Chromium or any special deployment configuration.
//
// NOTE: this endpoint is gated behind confirmed payment (see isSlugPaid
// below, only ever set by the verified webhook in api/webhook.js — never by
// anything the browser claims), OR a logged-in session that's an admin or
// has been granted free premium access (see lib/auth.js / premium_grants).

const PDFDocument = require('pdfkit');
const { getScanBySlug, isSlugPaid, hasPremiumGrant } = require('../lib/db');
const { getSessionEmail, isAdminEmail } = require('../lib/auth');

const COLORS = {
  primary: '#8B5CF6',
  secondary: '#EC4899',
  gold: '#C9820A',
  text: '#14141A',
  textDim: '#5B5B66',
  barBg: '#E9E9F0',
  line: '#E3E3EA'
};

function drawBar(doc, x, y, width, height, pct, color) {
  doc.roundedRect(x, y, width, height, height / 2).fill(COLORS.barBg);
  const clamped = Math.max(0, Math.min(100, pct));
  const fillWidth = Math.max(4, (width * clamped) / 100);
  doc.roundedRect(x, y, fillWidth, height, height / 2).fill(color);
}

function ensureSpace(doc, needed) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

function divider(doc) {
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(COLORS.line).stroke();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = req.query?.slug;
  if (!slug) {
    return res.status(400).json({ error: 'Provide a scan slug: /api/report?slug=xxxx' });
  }

  let data;
  try {
    data = await getScanBySlug(String(slug));
  } catch (err) {
    console.error('Report lookup failed:', err.message);
    return res.status(500).json({ error: 'Could not load that scan right now.' });
  }

  if (!data) {
    return res.status(404).json({ error: 'No saved scan found for this link.' });
  }

  let paid = false;
  try {
    paid = await isSlugPaid(String(slug));

    // Admins and comped ("premium grant") accounts bypass per-report
    // payment entirely — checked second, only if the direct purchase check
    // came back false, to avoid an unnecessary session lookup on the
    // common paid-normally path.
    if (!paid) {
      const sessionEmail = await getSessionEmail(req).catch(() => null);
      if (sessionEmail && (isAdminEmail(sessionEmail) || (await hasPremiumGrant(sessionEmail)))) {
        paid = true;
      }
    }
  } catch (err) {
    console.error('Payment check failed:', err.message);
    return res.status(500).json({ error: 'Could not verify payment right now. Try again shortly.' });
  }

  if (!paid) {
    return res.status(402).json({
      error: 'This report has not been purchased yet.',
      purchaseUrl: `https://www.getkiver.com/?s=${slug}#completeReportCard`
    });
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="kiver-report-${slug}.pdf"`);
  doc.pipe(res);

  // ---- Header / brand ----
  doc.rect(50, 45, 14, 14).fill(COLORS.primary);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(18).text('Kiver', 72, 44);
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.textDim).text('COMPLETE NOTABILITY REPORT', 72, 64);

  doc.y = 90;
  divider(doc);

  // ---- Entity + score ----
  doc.fillColor(COLORS.textDim).font('Helvetica').fontSize(10).text('ENTITY', 50, 110);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(22).text(data.query, 50, 124);

  doc.fillColor(COLORS.textDim).font('Helvetica').fontSize(10).text('OVERALL SCORE', 350, 110);
  doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(30).text(`${data.overallScore}/100`, 350, 122);
  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(11).text(String(data.tier || '').toUpperCase(), 350, 154);

  const genDate = new Date(data.scannedAt || Date.now()).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  doc.fillColor(COLORS.textDim).font('Helvetica').fontSize(9)
    .text(`Generated ${genDate}  ·  getkiver.com/?s=${slug}`, 50, 180);

  doc.y = 205;
  divider(doc);
  doc.moveDown(1.2);

  // ---- Score breakdown ----
  ensureSpace(doc, 40);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(13).text('Authority Analysis');
  doc.moveDown(0.6);

  const components = [
    ['Media Presence', data.components?.mediaPresence ?? 0],
    ['Source Quality', data.components?.sourceQuality ?? 0],
    ['Coverage Diversity', data.components?.coverageDiversity ?? 0],
    ['Recency', data.components?.recency ?? 0],
    ['Originality', data.components?.originality ?? 0],
    ['Entity Consistency', data.components?.entityConsistency ?? 0]
  ];

  components.forEach(([label, score]) => {
    ensureSpace(doc, 26);
    const rowY = doc.y;
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(10.5).text(label, 50, rowY, { width: 150 });
    drawBar(doc, 210, rowY + 2, 260, 8, score, COLORS.primary);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10.5).text(`${score}/100`, 480, rowY, { width: 60, align: 'right' });
    doc.y = rowY + 22;
  });

  doc.moveDown(1);

  // ---- Mentions summary ----
  ensureSpace(doc, 90);
  divider(doc);
  doc.moveDown(1);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(13).text('Media Footprint');
  doc.moveDown(0.6);

  const stats = [
    ['Web mentions found', data.mentionsFound ?? 0],
    ['Independent coverage', data.independentMentions ?? 0],
    ['Duplicate / syndicated', data.locked?.duplicateMentions ?? 0],
    ['Strongest publication', data.strongestPublication || 'Not conclusively identified']
  ];
  stats.forEach(([label, value]) => {
    ensureSpace(doc, 20);
    const rowY = doc.y;
    doc.fillColor(COLORS.textDim).font('Helvetica').fontSize(10.5).text(label, 50, rowY, { width: 220 });
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10.5).text(String(value), 280, rowY, { width: 260 });
    doc.y = rowY + 18;
  });

  // ---- Biggest gaps ----
  if (Array.isArray(data.topGaps) && data.topGaps.length) {
    doc.moveDown(1);
    ensureSpace(doc, 40);
    divider(doc);
    doc.moveDown(1);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(13).text('Biggest Authority Gaps');
    doc.moveDown(0.6);

    data.topGaps.slice(0, 5).forEach((gap, i) => {
      ensureSpace(doc, 50);
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(11).text(`${i + 1}. ${gap.title || 'Untitled gap'}`);
      if (gap.priority) {
        doc.fillColor(COLORS.secondary).font('Helvetica-Bold').fontSize(8).text(`PRIORITY: ${String(gap.priority).toUpperCase()}`);
      }
      if (gap.detail) {
        doc.fillColor(COLORS.textDim).font('Helvetica').fontSize(10).text(gap.detail, { width: 495 });
      }
      doc.moveDown(0.8);
    });
  }

  // ---- Source inventory ----
  if (Array.isArray(data.sources) && data.sources.length) {
    doc.moveDown(0.5);
    ensureSpace(doc, 40);
    divider(doc);
    doc.moveDown(1);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(13).text('Source Inventory');
    doc.moveDown(0.6);

    const shown = data.sources.slice(0, 20);
    shown.forEach((src) => {
      ensureSpace(doc, 34);
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10).text(src.title || 'Untitled', { width: 495 });
      const meta = [src.publication, src.classification].filter(Boolean).join(' · ');
      if (meta) {
        doc.fillColor(COLORS.textDim).font('Helvetica').fontSize(9).text(meta);
      }
      if (src.url) {
        doc.fillColor(COLORS.primary).font('Helvetica').fontSize(8.5).text(src.url, { width: 495 });
      }
      doc.moveDown(0.5);
    });

    if (data.sources.length > shown.length) {
      doc.fillColor(COLORS.textDim).font('Helvetica-Oblique').fontSize(9)
        .text(`+ ${data.sources.length - shown.length} more sources identified but not shown here.`);
    }
  }

  // ---- Disclaimer ----
  doc.moveDown(1.5);
  ensureSpace(doc, 60);
  divider(doc);
  doc.moveDown(1);
  doc.fillColor(COLORS.textDim).font('Helvetica').fontSize(8).text(
    data.disclaimer ||
      'This is an independent, analytical score based on observable public signals. Not affiliated with or endorsed by any search engine, social platform, or AI provider.',
    { width: 495 }
  );

  doc.end();
};
