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

  // Live search — filters the rows already on the page (name + tagline).
  // Only covers this page's results, not the whole database; that's fine
  // for the volumes this leaderboard has right now.
  const searchInput = document.getElementById('saasSearchInput');
  if (searchInput) {
    const rows = Array.from(document.querySelectorAll('.saas-list:not(.saas-list-top3) .saas-row'));
    const emptyMsg = document.createElement('li');
    emptyMsg.className = 'saas-empty';
    emptyMsg.textContent = 'No listings on this page match your search.';
    emptyMsg.style.display = 'none';
    const list = document.querySelector('.saas-list:not(.saas-list-top3)');
    if (list) list.appendChild(emptyMsg);

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      let anyVisible = false;
      rows.forEach((row) => {
        const name = row.querySelector('.saas-name')?.textContent.toLowerCase() || '';
        const tagline = row.querySelector('.saas-tagline')?.textContent.toLowerCase() || '';
        const match = !q || name.includes(q) || tagline.includes(q);
        row.style.display = match ? '' : 'none';
        if (match) anyVisible = true;
      });
      emptyMsg.style.display = q && !anyVisible ? '' : 'none';
    });
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // Top 3 Scans widget (homepage only) — every scanned SaaS lands on
  // the leaderboard, ranked by score; this teasers the top 3 using
  // the exact same row markup/styling as the real /saas leaderboard.
  function renderTop3Scans() {
    const grid = document.getElementById('top3ScansGrid');
    if (!grid) return;
    fetch('/api/saas?limit=5')
      .then((r) => r.json())
      .then((data) => {
        const listings = data.listings || [];
        if (!listings.length) {
          grid.innerHTML = '<li class="saas-empty">No SaaS scanned yet — <a href="/submit-saas.html">be the first</a>.</li>';
          return;
        }
        const rankClasses = ['rank-badge-diamond', 'rank-badge-gold', 'rank-badge-silver'];
        grid.innerHTML = listings
          .map((l, i) => `
    <li class="saas-row" data-slug="${escapeHtml(l.slug)}">
      <span class="saas-logo-wrap">
        <img class="saas-logo" src="${escapeHtml(l.logoUrl || '')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
        ${rankClasses[i] ? `<span class="rank-badge ${rankClasses[i]}">&#9733;</span>` : ''}
      </span>
      <a class="saas-name-link" href="/saas/${escapeHtml(l.slug)}">
        <span class="saas-name">${escapeHtml(l.name)}</span>
        <span class="saas-tagline">${escapeHtml(l.tagline || '')}</span>
      </a>
      <span class="saas-meta">
        <span class="saas-tier saas-tier-${escapeHtml((l.tier || 'new').toLowerCase())}">${l.tier === 'Elite' ? '&#9733; ' : ''}${escapeHtml(l.tier)}</span>
        <span class="saas-score">${l.baseScore}%</span>
      </span>
      <button class="saas-upvote" data-slug="${escapeHtml(l.slug)}" aria-label="Upvote ${escapeHtml(l.name)}">
        <span class="saas-upvote-arrow">&#9650;</span>
        <span class="saas-upvote-count">${l.upvotes}</span>
      </button>
    </li>`)
          .join('');
      })
      .catch(() => {
        grid.innerHTML = '<li class="saas-empty">Could not load the leaderboard right now.</li>';
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
      logoUrl: form.logoUrl.value.trim(),
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
