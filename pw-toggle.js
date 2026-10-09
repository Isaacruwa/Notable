/* Kiver: show/hide button for password fields. */
(function () {
  "use strict";
  var EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19c-6.4 0-10-7-10-7a18.3 18.3 0 0 1 5-5.7M9.9 5.2A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.2 3.2"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="M2 2l20 20"/></svg>';
  function enhance(input) {
    if (input.getAttribute("data-pw-toggle")) return;
    input.setAttribute("data-pw-toggle", "1");
    var wrap = document.createElement("span");
    wrap.className = "pw-field";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pw-toggle";
    btn.setAttribute("aria-label", "Show password");
    btn.setAttribute("aria-pressed", "false");
    btn.innerHTML = EYE;
    wrap.appendChild(btn);
    function set(show) {
      var start = null, end = null;
      try { start = input.selectionStart; end = input.selectionEnd; } catch (_) {}
      input.type = show ? "text" : "password";
      btn.innerHTML = show ? EYE_OFF : EYE;
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      btn.setAttribute("aria-pressed", show ? "true" : "false");
      btn.classList.toggle("on", show);
      if (document.activeElement !== input) input.focus();
      try { if (start !== null) input.setSelectionRange(start, end); } catch (_) {}
    }
    btn.addEventListener("click", function () { set(input.type === "password"); });
    // Never leave a password showing when the tab is hidden or the form is sent.
    document.addEventListener("visibilitychange", function () { if (document.hidden && input.type !== "password") set(false); });
    if (input.form) input.form.addEventListener("submit", function () { if (input.type !== "password") { input.type = "password"; btn.innerHTML = EYE; btn.setAttribute("aria-label", "Show password"); btn.setAttribute("aria-pressed", "false"); btn.classList.remove("on"); } });
  }
  function init() {
    var list = document.querySelectorAll('input[type="password"]');
    for (var i = 0; i < list.length; i++) enhance(list[i]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
