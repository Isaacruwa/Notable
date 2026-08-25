// ---------- Radar ticks around the ring ----------
(function buildTicks() {
  const rig = document.querySelector('.rig');
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

function renderResult(data) {
  document.getElementById('rbName').textContent = data.query;
  document.getElementById('rbScore').textContent = data.overallScore;
  document.getElementById('rbTier').textContent = data.tier.toUpperCase();
  document.getElementById('rbMentions').textContent = data.mentionsFound;
  document.getElementById('rbIndependent').textContent = data.independentMentions;
  document.getElementById('rbConfidence').textContent = data.matchConfidence + '%';

  const engineEl = document.getElementById('rbEngine');
  if (engineEl) {
    if (data.engine === 'live') engineEl.textContent = '● LIVE SCAN';
    else if (data.engine === 'mock-fallback') engineEl.textContent = '● MOCK (live pipeline errored, check keys)';
    else engineEl.textContent = '● MOCK (add API keys to go live)';
  }

  resultBanner.classList.add('show');
}

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
