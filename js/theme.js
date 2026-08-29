// theme.js — light/dark mode toggle, shared across every page.
// The theme itself is applied instantly in an inline <head> script on each
// page (before CSS paints) to avoid a flash of the wrong theme. This file
// only wires up the toggle button's click behavior and keeps its icon in sync.

(function () {
  var btn = document.getElementById('themeToggle');
  if (!btn) return;

  function isLight() {
    return document.documentElement.getAttribute('data-theme') === 'light';
  }

  function updateIcon() {
    var light = isLight();
    btn.textContent = light ? '🌙' : '☀️';
    btn.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
  }

  updateIcon();

  btn.addEventListener('click', function () {
    var next = isLight() ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('kiver-theme', next);
    } catch (e) {
      /* localStorage unavailable (private browsing etc.) — theme just won't persist */
    }
    updateIcon();
  });
})();
