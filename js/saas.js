// js/saas.js
//
// Progressive enhancement for the SaaS Leaderboard pages
// (server-rendered by api/saas-page.js) plus the submission form on
// submit-saas.html. The pages already show real content with JS
// off — this just makes them interactive.

(function () {
  function onUpvoteClick(btn) {
    if (btn.dataset.busy === '1') return;
    btn.dataset.busy = '1';
    const slug = btn.dataset.slug;
    fetch('/api/saas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upvote', slug })
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        const countEl = btn.querySelector('.saas-upvote-count');
        if (countEl) countEl.textContent = data.upvotes;
        btn.classList.add('voted');
      })
      .catch(() => {})
      .finally(() => {
        btn.dataset.busy = '0';
      });
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.saas-upvote');
    if (btn) onUpvoteClick(btn);
  });

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // Top 3 Scans widget (homepage only) — every scanned SaaS lands on
  // the leaderboard, ranked by score; this just teasers the top 3.
  function renderTop3Scans() {
    const grid = document.getElementById('top3ScansGrid');
    if (!grid) return;
    fetch('/api/saas?limit=3')
      .then((r) => r.json())
      .then((data) => {
        const listings = data.listings || [];
        if (!listings.length) {
          grid.innerHTML = '<p class="top3scans-empty">No SaaS scanned yet — <a href="/submit-saas.html">be the first</a>.</p>';
          return;
        }
        grid.innerHTML = listings
          .map((l, i) => {
            const tierClass = l.tier === 'Elite' || l.tier === 'Strong' ? 'tier-strong'
              : l.tier === 'Rising' ? 'tier-dev' : 'tier-est';
            return `
        <a class="pcard" href="/saas/${escapeHtml(l.slug)}">
          <span class="top3scans-rank">${i + 1}</span>
          <div class="row1">
            <div class="avatar" style="background:linear-gradient(135deg,#4FACFE,#00F2FE)"></div>
            <div>
              <div class="name">${escapeHtml(l.name)}</div>
              <div class="tag">${escapeHtml((l.category || 'SAAS').toUpperCase())}</div>
            </div>
          </div>
          <div class="bar-bg"><div class="bar-fg" style="width:${l.baseScore}%"></div></div>
          <div class="foot">
            <span class="val">${l.baseScore}%</span>
            <span class="tier ${tierClass}">${escapeHtml(l.tier.toUpperCase())}</span>
          </div>
        </a>`;
          })
          .join('');
      })
      .catch(() => {
        grid.innerHTML = '<p class="top3scans-empty">Could not load the leaderboard right now.</p>';
      });
  }
  renderTop3Scans();

  // Submission form (submit-saas.html only) — everything below is a
  // no-op on other pages since the form won't exist.
  const form = document.getElementById('saas-submit-form');
  if (!form) return;

  const resultBox = document.getElementById('saas-form-result');
  const submitBtn = form.querySelector('.saas-submit-btn');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Scanning & scoring…';
    resultBox.innerHTML = '';

    const payload = {
      action: 'submit',
      name: form.name.value.trim(),
      websiteUrl: form.websiteUrl.value.trim(),
      tagline: form.tagline.value.trim(),
      description: form.description.value.trim(),
      category: form.category.value,
      launchYear: form.launchYear.value,
      submitterEmail: form.submitterEmail.value.trim()
    };

    fetch('/api/saas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          resultBox.innerHTML = `<p class="saas-form-error">${data.error || 'Something went wrong.'}</p>`;
          return;
        }
        resultBox.innerHTML = `<p>Scored <strong>${data.baseScore}%</strong> — ${data.tier} tier. Redirecting to your listing…</p>`;
        setTimeout(() => {
          window.location.href = data.url;
        }, 1200);
      })
      .catch(() => {
        resultBox.innerHTML = `<p class="saas-form-error">Network error — try again.</p>`;
      })
      .finally(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit & get scored';
      });
  });
})();
