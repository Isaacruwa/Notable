// ---------- Radar ticks around the ring ----------
(function buildTicks() {
  const rig = document.querySelector('.rig-inner');
  if (!rig) return;
  const n = 36;
  for (let i = 0; i < n; i++) {
    const t = document.createElement('div');
    t.className = 'radar-tick';
    t.style.transform = `translate(-50%,-200px) rotate(${(360 / n) * i}deg)`;
    t.style.transformOrigin = '50% 200px';
    t.style.opacity = i % 3 === 0 ? '0.6' : '0.2';
    rig.appendChild(t);
  }
})();

// ---------- Carousel of fictional profile cards ----------
const profiles = [
  { name: 'Lumen & Co', tag: 'CONSUMER BRAND', val: 82, tier: 'STRONG', tc: 'tier-strong' },
  { name: 'north.studio', tag: 'CREATOR', val: 64, tier: 'DEVELOPING', tc: 'tier-dev' },
  { name: 'Vertex Labs', tag: 'STARTUP', val: 71, tier: 'ESTABLISHED', tc: 'tier-est' },
  { name: 'Kettlewell Press', tag: 'PUBLISHER', val: 58, tier: 'DEVELOPING', tc: 'tier-dev' },
  { name: '@majormood', tag: 'CREATOR', val: 76, tier: 'STRONG', tc: 'tier-strong' },
  { name: 'Ashford Group', tag: 'COMPANY', val: 78, tier: 'STRONG', tc: 'tier-strong' },
  { name: 'Solace & Fields', tag: 'BRAND', val: 49, tier: 'EMERGING', tc: 'tier-dev' },
  { name: 'Ridgeway Analytics', tag: 'B2B SAAS', val: 69, tier: 'ESTABLISHED', tc: 'tier-est' }
];

function cardHTML(p, hi) {
  return `
    <div class="pcard ${hi ? 'hi' : ''}">
      <div class="row1">
        <div class="avatar" style="background:linear-gradient(135deg,#4FACFE,#00F2FE)"></div>
        <div>
          <div class="name">${p.name}</div>
          <div class="tag">${p.tag}</div>
        </div>
      </div>
      <div class="bar-bg"><div class="bar-fg" style="width:${p.val}%"></div></div>
      <div class="foot">
        <span class="val">${p.val}</span>
        <span class="tier ${p.tc}">${p.tier}</span>
      </div>
    </div>`;
}

const track = document.getElementById('carouselTrack');
if (track) {
  const doubled = [...profiles, ...profiles];
  track.innerHTML = doubled.map((p, i) => cardHTML(p, i % profiles.length === 2)).join('');
}

// ---------- Reticle score animation ----------
function animateReticleScore(target) {
  const el = document.querySelector('.reticle .score');
  if (!el) return;
  let cur = 0;
  const iv = setInterval(() => {
    cur += Math.ceil((target - cur) * 0.18) || 1;
    if (cur >= target) {
      cur = target;
      clearInterval(iv);
    }
    el.innerHTML = cur + '<sub>/100</sub>';
  }, 90);
}
animateReticleScore(88); // ambient demo value on page load

// ---------- Audience word loop ----------
(function audienceLoop() {
  const el = document.getElementById('audienceWord');
  if (!el) return;
  const words = ['Influencers', 'Brands', 'Businesses', 'Creators', 'Founders', 'Companies', 'Organizations', 'Public Figures'];
  let i = 0;
  setInterval(() => {
    el.classList.add('fade');
    setTimeout(() => {
      i = (i + 1) % words.length;
      el.textContent = words[i];
      el.classList.remove('fade');
    }, 350);
  }, 1800);
})();

// ---------- Live scan: wire the hero form to /api/scan ----------
const scanForm = document.getElementById('scanForm');
const scanInput = document.getElementById('scanInput');
const scanBtn = document.getElementById('scanBtn');
const resultBanner = document.getElementById('resultBanner');
const formError = document.getElementById('formError');

async function runScan(query) {
  formError.textContent = '';
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning…';

  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Scan failed. Try again.');
    }

    const data = await res.json();
    renderResult(data);

    // Also reflect the real score in the live scan-sequence reticle,
    // so the demo above and the real result feel like one system.
    document.querySelector('.reticle .score').innerHTML =
      data.overallScore + '<sub>/100</sub>';
    const mentionEl = document.querySelector('.mention-counter .n');
    if (mentionEl) mentionEl.textContent = data.mentionsFound.toLocaleString();
    const confEl = document.querySelector('.rig-conf b');
    if (confEl) confEl.textContent = data.matchConfidence.toFixed(1) + '%';

    document.getElementById('scan').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    formError.textContent = e.message || 'Something went wrong. Try again.';
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = 'Check My Notability →';
  }
}

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'entity';
}

function setBar(barId, valId, value) {
  const bar = document.getElementById(barId);
  const val = document.getElementById(valId);
  if (bar) bar.style.width = value + '%';
  if (val) val.textContent = value + '/100';
}

function renderResult(data) {
  // ---- Top result banner ----
  document.getElementById('rbName').textContent = data.query;
  document.getElementById('rbScore').textContent = data.overallScore;
  document.getElementById('rbTier').textContent = data.tier.toUpperCase();
  document.getElementById('rbMentions').textContent = data.mentionsFound;
  document.getElementById('rbIndependent').textContent = data.independentMentions;
  document.getElementById('rbConfidence').textContent = data.matchConfidence + '%';

  const engineEl = document.getElementById('rbEngine');
  if (engineEl) {
    if (data.engine === 'live') {
      engineEl.textContent = '● LIVE SCAN — REAL DATA';
      engineEl.style.background = 'rgba(0,242,254,0.14)';
      engineEl.style.color = '#00F2FE';
      engineEl.style.border = '1px solid rgba(0,242,254,0.4)';
    } else if (data.engine === 'mock-fallback') {
      engineEl.textContent = '● MOCK — LIVE PIPELINE ERRORED, CHECK KEYS';
      engineEl.style.background = 'rgba(255,92,122,0.14)';
      engineEl.style.color = '#FF5C7A';
      engineEl.style.border = '1px solid rgba(255,92,122,0.4)';
    } else {
      engineEl.textContent = '● MOCK — ADD API KEYS TO GO LIVE';
      engineEl.style.background = 'rgba(255,200,87,0.14)';
      engineEl.style.color = '#FFC857';
      engineEl.style.border = '1px solid rgba(255,200,87,0.4)';
    }
  }

  resultBanner.classList.add('show');

  // ---- "Notable found X" line ----
  const dupCount = data.locked?.duplicateMentions ?? 0;
  const classifiedCount = (data.sources && data.sources.length) || null;
  const fm = document.getElementById('foundMentions'); if (fm) fm.textContent = data.mentionsFound;
  const fi = document.getElementById('foundIndependent'); if (fi) fi.textContent = data.independentMentions;
  const fd = document.getElementById('foundDup'); if (fd) fd.textContent = dupCount;
  const fc = document.getElementById('foundClassified'); if (fc) fc.textContent = classifiedCount ?? '—';

  // ---- Findings section ----
  document.getElementById('fMentions').textContent = data.mentionsFound;
  document.getElementById('fIndependent').textContent = data.independentMentions;
  document.getElementById('fPublication').textContent = data.strongestPublication || 'Not conclusively identified';
  document.getElementById('fTier').textContent = data.tier;
  document.getElementById('fRatio').textContent = `${data.independentMentions} / ${data.mentionsFound}`;
  document.getElementById('fConfidence').textContent = data.matchConfidence + '%';
  const findingsLabel = document.getElementById('findingsLabel');
  if (findingsLabel) findingsLabel.textContent = 'YOUR FREE RESULT · ' + data.query.toUpperCase();

  // ---- "What about the other X?" ----
  const qOther = document.getElementById('qOther');
  if (qOther) qOther.textContent = Math.max(0, data.mentionsFound - data.independentMentions);

  // ---- "Which sources are strengthening my authority?" real teaser ----
  const qSourceTeaser = document.getElementById('qSourceTeaser');
  if (qSourceTeaser) {
    if (classifiedCount) {
      qSourceTeaser.textContent = `Kiver classified ${classifiedCount} individual sources by editorial weight and impact.`;
    } else {
      qSourceTeaser.textContent = `Kiver classified your ${data.independentMentions} independent sources by editorial weight and impact.`;
    }
  }

  // ---- "What's holding me back?" real teaser (title only, reasoning stays locked) ----
  const qGapTeaser = document.getElementById('qGapTeaser');
  if (qGapTeaser) {
    const topGap = (data.topGaps && data.topGaps[0]) ? data.topGaps[0].title : null;
    qGapTeaser.textContent = topGap
      ? `Kiver flagged: "${topGap}."`
      : 'Kiver identified at least one authority gap.';
  }

  // ---- Share card ----
  document.getElementById('shareName').textContent = data.query;
  document.getElementById('shareScore').textContent = data.overallScore;
  document.getElementById('shareTierLine').textContent =
    `${data.tier.toUpperCase()} · ${data.mentionsFound} MENTIONS INDEXED`;
  const shareLabel = document.getElementById('shareLabel');
  if (shareLabel) shareLabel.textContent = 'BUILT TO SHARE';

  const shareHandleEl = document.getElementById('shareHandle');
  if (data.shareSlug) {
    currentShareUrl = buildShareUrl(data.shareSlug);
    if (shareHandleEl) shareHandleEl.textContent = currentShareUrl.replace(/^https?:\/\//, '');
  } else {
    // No share link this time (e.g. database briefly unavailable) — be
    // honest about it rather than showing a fake, non-functional path.
    currentShareUrl = null;
    if (shareHandleEl) shareHandleEl.textContent = 'Share link unavailable right now';
  }
}

// ---------- Share link handling ----------
let currentShareUrl = null;

function buildShareUrl(slug) {
  return `${window.location.origin}/?s=${slug}`;
}

const copyLinkBtn = document.getElementById('copyLinkBtn');
if (copyLinkBtn) {
  copyLinkBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!currentShareUrl) return;
    try {
      await navigator.clipboard.writeText(currentShareUrl);
      const original = copyLinkBtn.textContent;
      copyLinkBtn.textContent = 'COPIED!';
      setTimeout(() => { copyLinkBtn.textContent = original; }, 1500);
    } catch (err) {
      // Clipboard API unavailable — fall back to just navigating there
      window.prompt('Copy this link:', currentShareUrl);
    }
  });
}

const shareBtn = document.getElementById('shareBtn');
if (shareBtn) {
  shareBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!currentShareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Kiver Notability Score', url: currentShareUrl });
      } catch (err) {
        /* user cancelled the share sheet — no action needed */
      }
    } else {
      try {
        await navigator.clipboard.writeText(currentShareUrl);
        window.alert('Link copied: ' + currentShareUrl);
      } catch (err) {
        window.prompt('Copy this link:', currentShareUrl);
      }
    }
  });
}

// ---------- Load a shared scan from the URL, if present (?s=slug) ----------
(function loadSharedScanFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('s');
  if (!slug) return;

  fetch('/api/scan?slug=' + encodeURIComponent(slug))
    .then((res) => {
      if (!res.ok) throw new Error('Saved scan not found');
      return res.json();
    })
    .then((data) => {
      renderResult(data);
      document.getElementById('scan').scrollIntoView({ behavior: 'smooth', block: 'start' });
    })
    .catch(() => {
      // Bad or expired link — fail quietly, the normal free-scan page still works fine
    });
})();

if (scanForm) {
  scanForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = scanInput.value.trim();
    if (q.length < 2) {
      formError.textContent = 'Enter a name, brand, or company to scan.';
      return;
    }
    runScan(q);
  });
}

// ---------- PWA: register service worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/public/sw.js').catch(() => {
      /* non-fatal — app still works without offline support */
    });
  });
}
