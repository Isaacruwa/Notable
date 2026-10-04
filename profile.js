/* Kiver account page: choose or change your username. */
(function () {
  "use strict";
  var body = document.getElementById("profileBody");
  if (!body) return;
  var BADGE = '<svg class="verified-badge user-verified" viewBox="0 0 18 18" width="16" height="16" role="img" aria-label="Verified user" xmlns="http://www.w3.org/2000/svg"><title>Verified</title><polygon fill="#0099FD" points="9,16 7.1,16.9 5.8,15.2 3.7,15.1 3.4,13 1.5,12 2.2,9.9 1.1,8.2 2.6,6.7 2.4,4.6 4.5,4 5.3,2 7.4,2.4 9,1.1 10.7,2.4 12.7,2 13.6,4 15.6,4.6 15.5,6.7 17,8.2 15.9,9.9 16.5,12 14.7,13 14.3,15.1 12.2,15.2 10.9,16.9"/><polygon fill="#FFFFFF" points="13.1,7.3 12.2,6.5 8.1,10.6 5.9,8.5 5,9.4 8,12.4"/></svg>';
  var me = null, seq = 0, timer = null;
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function api(url, opts) {
    return fetch(url, opts || { credentials: "same-origin" }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error((d && d.error) || "Something went wrong. Please try again."); return d; });
    });
  }
  function status(msg, ok) { var el = body.querySelector(".form-status"); if (el) { el.textContent = msg || ""; el.className = "form-status" + (ok ? " ok" : ""); } }
  function render() {
    if (!me || !me.loggedIn) { body.innerHTML = '<p class="muted">Sign in to choose a username.</p>'; return; }
    var cur = me.username || "";
    var html = "";
    if (cur) html += '<div class="profile-current"><b>@' + esc(cur) + "</b>" + (me.verified ? BADGE + '<span class="profile-tag">Verified</span>' : "") + "</div>";
    else html += '<p class="muted">You haven\u2019t chosen a username yet. You need one to post reviews.</p>';
    html += '<form class="username-form" id="unForm" novalidate><input id="unInput" maxlength="20" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Username" placeholder="' + (cur ? "New username" : "e.g. alex_builds") + '" value="' + esc(cur) + '"><button class="dark-button" type="submit">' + (cur ? "Change username" : "Save username") + ' <span>\u2192</span></button></form><p class="username-hint" id="unHint">3 to 20 letters, numbers or underscores.' + (cur ? " You can change it once every 30 days." : "") + '</p><p class="form-status" role="status"></p>';
    body.innerHTML = html;
    var input = body.querySelector("#unInput"), hint = body.querySelector("#unHint"), form = body.querySelector("#unForm");
    input.addEventListener("input", function () {
      var v = input.value.trim().replace(/^@/, ""); clearTimeout(timer);
      if (!v || v.toLowerCase() === cur.toLowerCase()) { hint.className = "username-hint"; return; }
      var my = ++seq;
      timer = setTimeout(function () {
        api("/api/bots?action=checkUsername&username=" + encodeURIComponent(v)).then(function (r) {
          if (my !== seq) return; hint.className = "username-hint " + (r.available ? "ok" : "bad");
          hint.textContent = r.available ? "\u2713 @" + v + " is available" : (r.reason || "That username isn\u2019t available.");
        }).catch(function () {});
      }, 350);
    });
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var v = input.value.trim().replace(/^@/, ""); if (!v) { status("Enter a username."); return; }
      var btn = form.querySelector("button"); btn.disabled = true;
      api("/api/bots", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setUsername", username: v }) })
        .then(function (r) { me.username = r.username; me.verified = !!r.verified; render(); status("Username saved.", true); })
        .catch(function (e) { btn.disabled = false; status(e.message); });
    });
  }
  api("/api/me").then(function (m) { me = m; render(); }).catch(function () { body.innerHTML = '<p class="muted">Could not load your profile.</p>'; });
})();
