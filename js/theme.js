// theme.js — light/dark mode toggle, shared across every page.
//
// Behavior:
// - On first visit (no saved choice), the site follows the phone/OS's
//   color-scheme setting — including if that OS setting itself auto-switches
//   at certain times of day, since we listen live for that change.
// - The moment someone taps the floating toggle, that becomes an explicit,
//   saved choice, and from then on the site stops auto-following the system
//   and just uses what they picked.
//
// The initial theme is set instantly by an inline script in <head> (to avoid
// a flash of the wrong theme before this file even loads) — this file only
// wires up the button and the live system-change listener.

(function () {
  var btn = document.getElementById('themeToggle');

  var SUN_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle>' +
    '<line x1="12" y1="2" x2="12" y2="4"></line><line x1="12" y1="20" x2="12" y2="22"></line>' +
    '<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>' +
    '<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>' +
    '<line x1="2" y1="12" x2="4" y2="12"></line><line x1="20" y1="12" x2="22" y2="12"></line>' +
    '<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>' +
    '<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';

  var MOON_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor">' +
    '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

  function hasOverride() {
    try {
      return localStorage.getItem('kiver-theme') !== null;
    } catch (e) {
      return false;
    }
  }

  function isLight() {
    return document.documentElement.getAttribute('data-theme') === 'light';
  }

  function updateIcon() {
    if (!btn) return;
    var light = isLight();
    btn.innerHTML = light ? MOON_SVG : SUN_SVG;
    btn.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
  }

  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onSystemChange = function (e) {
      if (hasOverride()) return;
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      updateIcon();
    };
    if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
    else if (mq.addListener) mq.addListener(onSystemChange);
  }

  updateIcon();

  if (btn) {
    btn.addEventListener('click', function () {
      var next = isLight() ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem('kiver-theme', next);
      } catch (e) {
        /* localStorage unavailable — theme just won't persist across visits */
      }
      updateIcon();
    });
  }
})();
