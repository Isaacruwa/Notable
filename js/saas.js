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
