/* Kiver account page: your public profile, username and paid verification. */
(function () {
  "use strict";
  var body = document.getElementById("profileBody");
  if (!body) return;
  var PRICE = "pri_01m4444hd5gatkgd89njpsqfd7";
  var PENDING = "kiver_verify_pending";
  var STYLES = ["violet", "blue", "teal", "green", "amber", "orange", "rose", "slate"];
  var BADGE = '<svg class="verified-badge user-verified" viewBox="0 0 18 18" width="18" height="18" role="img" aria-label="Verified user" xmlns="http://www.w3.org/2000/svg"><title>Verified</title><polygon fill="#0099FD" points="9,16 7.1,16.9 5.8,15.2 3.7,15.1 3.4,13 1.5,12 2.2,9.9 1.1,8.2 2.6,6.7 2.4,4.6 4.5,4 5.3,2 7.4,2.4 9,1.1 10.7,2.4 12.7,2 13.6,4 15.6,4.6 15.5,6.7 17,8.2 15.9,9.9 16.5,12 14.7,13 14.3,15.1 12.2,15.2 10.9,16.9"/><polygon fill="#FFFFFF" points="13.1,7.3 12.2,6.5 8.1,10.6 5.9,8.5 5,9.4 8,12.4"/></svg>';
  var pf = null, style = null, seq = 0, timer = null, pollTimer = null, pollCount = 0;

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function api(url, opts) {
    return fetch(url, opts || { credentials: "same-origin" }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var e = new Error((d && d.error) || "Something went wrong. Please try again."); e.status = r.status; throw e; }
        return d;
      });
    });
  }
  function post(url, data) {
    return api(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  }
  function fmtMonth(s) { try { return new Date(s).toLocaleDateString("en-US", { month: "long", year: "numeric" }); } catch (e) { return ""; } }
  function fmtDay(s) { try { return new Date(s).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); } catch (e) { return ""; } }
  function note(id, msg, ok) { var el = body.querySelector("#" + id); if (el) { el.textContent = msg || ""; el.className = "form-status" + (ok ? " ok" : ""); } }
  function initial() { return String(pf.displayName || pf.username || pf.email || "K").charAt(0).toUpperCase(); }

  function headHtml() {
    var name = pf.displayName || (pf.username ? "@" + pf.username : "Add your name");
    var sub = (pf.username ? "@" + esc(pf.username) + " \u00b7 " : "") + "Joined " + esc(fmtMonth(pf.joinedAt));
    return '<div class="pf-head"><div class="pf-avatar pf-c-' + esc(pf.avatarStyle || "violet") + '" id="pfAvatar" aria-hidden="true">' + esc(initial()) + '</div>' +
      '<div class="pf-head-copy"><div class="pf-name"><b>' + esc(name) + '</b>' + (pf.verified ? BADGE : "") + '</div>' +
      '<div class="pf-sub">' + sub + '</div>' +
      '<div class="pf-stats"><span><b>' + (pf.listings || 0) + '</b> ' + (pf.listings === 1 ? "tool" : "tools") + '</span><span><b>' + (pf.reviews || 0) + '</b> ' + (pf.reviews === 1 ? "review" : "reviews") + '</span></div></div></div>';
  }

  function editHtml() {
    var sw = STYLES.map(function (s) {
      return '<button type="button" class="pf-swatch pf-c-' + s + (s === style ? " on" : "") + '" data-style="' + s + '" aria-label="' + s + ' avatar color" aria-pressed="' + (s === style) + '"></button>';
    }).join("");
    return '<form class="pf-form" id="pfForm" novalidate><h3>Edit your profile</h3>' +
      '<label for="pfName">Display name</label><input id="pfName" maxlength="40" autocomplete="name" placeholder="Your name" value="' + esc(pf.displayName || "") + '">' +
      '<label for="pfBio">Bio <span class="pf-count" id="pfCount">' + String((pf.bio || "").length) + '/160</span></label><textarea id="pfBio" maxlength="160" rows="3" placeholder="What do you build or use on Telegram?">' + esc(pf.bio || "") + '</textarea>' +
      '<label>Avatar color</label><div class="pf-swatches" role="group" aria-label="Avatar color">' + sw + '</div>' +
      '<button class="dark-button" type="submit">Save profile <span>\u2192</span></button><p class="form-status" id="pfStatus" role="status"></p></form>';
  }

  function usernameHtml() {
    var cur = pf.username || "";
    return '<div class="pf-block"><h3>Username</h3>' +
      (cur ? "" : '<p class="muted">You haven\u2019t chosen a username yet. You need one to post reviews and to get verified.</p>') +
      '<form class="username-form" id="unForm" novalidate><input id="unInput" maxlength="20" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Username" placeholder="' + (cur ? "New username" : "e.g. alex_builds") + '" value="' + esc(cur) + '"><button class="dark-button" type="submit">' + (cur ? "Change username" : "Save username") + ' <span>\u2192</span></button></form>' +
      '<p class="username-hint" id="unHint">3 to 20 letters, numbers or underscores.' + (cur ? " You can change it once every 30 days." : "") + '</p><p class="form-status" id="unStatus" role="status"></p></div>';
  }

  function verifyHtml() {
    if (pf.verified) {
      var line = pf.verifiedSource === "kiver" ? "Verified by Kiver." : "Your badge is active until <b>" + esc(fmtDay(pf.verifiedUntil)) + "</b> and renews yearly.";
      var manage = pf.subscription && pf.subscription.cancelUrl ? '<a class="text-link" href="' + esc(pf.subscription.cancelUrl) + '" target="_blank" rel="noopener noreferrer">Manage or cancel subscription \u2197</a>' : (pf.subscription ? '<p class="muted">To cancel, use the link in your Paddle receipt email.</p>' : "");
      return '<div class="pf-block pf-verify on"><div class="pf-verify-head">' + BADGE + '<h3>You\u2019re verified</h3></div><p>' + line + '</p>' + manage + '</div>';
    }
    var pending = sessionStorage.getItem(PENDING);
    if (pending) {
      return '<div class="pf-block pf-verify"><h3>Activating your badge\u2026</h3><p class="muted" id="pfPending">Payment received. This usually takes a few seconds.</p></div>';
    }
    if (!pf.verifyAvailable) {
      return '<div class="pf-block pf-verify"><span class="eyebrow">VERIFIED PROFILE</span><h3>Verified badge: opening soon</h3>' +
        '<ul class="pf-benefits"><li>Blue badge next to your @username on every review you post</li><li>A public profile page at getkiver.com/u/you that search engines can index</li><li>More trust from the people reading your reviews and tools</li></ul>' +
        '<p class="muted">Verification isn\u2019t open yet. Your profile and username work as usual in the meantime.</p></div>';
    }
    var needUser = !pf.username;
    return '<div class="pf-block pf-verify"><span class="eyebrow">VERIFIED PROFILE</span><h3>Get your blue verified badge</h3>' +
      '<ul class="pf-benefits"><li>Blue badge next to your @username on every review you post</li><li>A public profile page at getkiver.com/u/you that search engines can index</li><li>More trust from the people reading your reviews and tools</li></ul>' +
      '<p class="pf-price"><b>3-day free trial</b>, then <b>$19/year</b>. Cancel anytime.</p>' +
      '<label class="payment-consent"><input id="pfConsent" type="checkbox"><span>I agree to the <a href="/terms.html" target="_blank" rel="noopener">Terms</a> and <a href="/refund.html" target="_blank" rel="noopener">Refund Policy</a>.</span></label>' +
      '<button class="dark-button" id="pfVerifyBtn" type="button"' + (needUser ? " disabled" : "") + '>Start free trial <span>\u2192</span></button>' +
      (needUser ? '<p class="muted">Choose a username above first.</p>' : "") + '<p class="form-status" id="pfVerifyStatus" role="status"></p></div>';
  }

  function render() {
    style = style || pf.avatarStyle || "violet";
    var link = document.getElementById("profileViewLink");
    if (link) { if (pf.username) { link.href = "/u/" + encodeURIComponent(pf.username); link.classList.remove("hidden"); } else link.classList.add("hidden"); }
    body.innerHTML = headHtml() + editHtml() + usernameHtml() + verifyHtml();
    wire();
    if (!pf.verified && sessionStorage.getItem(PENDING)) startPolling();
  }

  function wire() {
    var form = body.querySelector("#pfForm"), nameEl = body.querySelector("#pfName"), bioEl = body.querySelector("#pfBio"), count = body.querySelector("#pfCount");
    if (bioEl) bioEl.addEventListener("input", function () { count.textContent = bioEl.value.length + "/160"; });
    body.querySelectorAll(".pf-swatch").forEach(function (b) {
      b.addEventListener("click", function () {
        style = b.getAttribute("data-style");
        body.querySelectorAll(".pf-swatch").forEach(function (x) { var on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-pressed", String(on)); });
        var av = body.querySelector("#pfAvatar"); av.className = "pf-avatar pf-c-" + style;
      });
    });
    if (form) form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var btn = form.querySelector("button[type=submit]"); btn.disabled = true; note("pfStatus", "");
      post("/api/account", { action: "profileUpdate", displayName: nameEl.value, bio: bioEl.value, avatarStyle: style })
        .then(function (r) { pf = r; style = pf.avatarStyle || style; render(); note("pfStatus", "Profile saved.", true); })
        .catch(function (e) { btn.disabled = false; note("pfStatus", e.message); });
    });

    var input = body.querySelector("#unInput"), hint = body.querySelector("#unHint"), uform = body.querySelector("#unForm"), cur = pf.username || "";
    if (input) input.addEventListener("input", function () {
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
    if (uform) uform.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var v = input.value.trim().replace(/^@/, ""); if (!v) { note("unStatus", "Enter a username."); return; }
      var btn = uform.querySelector("button"); btn.disabled = true;
      post("/api/bots", { action: "setUsername", username: v })
        .then(function () { return load(); })
        .then(function () { note("unStatus", "Username saved.", true); })
        .catch(function (e) { btn.disabled = false; note("unStatus", e.message); });
    });

    var vb = body.querySelector("#pfVerifyBtn");
    if (vb) vb.addEventListener("click", function () {
      var consent = body.querySelector("#pfConsent");
      if (!consent.checked) { note("pfVerifyStatus", "Please accept the Terms and Refund Policy before continuing."); return; }
      if (typeof window.kiverInitPaddle !== "function") { note("pfVerifyStatus", "Payments are still loading. Please try again in a moment."); return; }
      vb.disabled = true; note("pfVerifyStatus", "");
      window.kiverInitPaddle().then(function () {
        window.Paddle.Checkout.open({
          items: [{ priceId: PRICE, quantity: 1 }],
          customer: { email: pf.email },
          customData: { type: "user_verification", owner_email: pf.email },
          settings: { displayMode: "overlay", theme: "light" }
        });
        vb.disabled = false;
      }).catch(function (e) { vb.disabled = false; note("pfVerifyStatus", e && e.message ? e.message : "Payments are not available right now."); });
    });
  }

  function startPolling() {
    if (pollTimer) return;
    pollCount = 0;
    pollTimer = setInterval(function () {
      pollCount++;
      api("/api/account?action=profile").then(function (r) {
        if (r.verified) { clearInterval(pollTimer); pollTimer = null; sessionStorage.removeItem(PENDING); pf = r; render(); }
        else if (pollCount >= 20) {
          clearInterval(pollTimer); pollTimer = null;
          var el = body.querySelector("#pfPending");
          if (el) el.textContent = "This is taking longer than usual. Refresh the page in a minute. If your badge still isn\u2019t there, contact support with your Paddle receipt.";
          sessionStorage.removeItem(PENDING);
        }
      }).catch(function () {});
    }, 3000);
  }

  window.addEventListener("kiver:paddle", function (ev) {
    var d = ev && ev.detail;
    if (d && d.name === "checkout.completed") { try { sessionStorage.setItem(PENDING, "1"); } catch (e) {} }
  });

  function load() {
    return api("/api/account?action=profile").then(function (r) { pf = r; style = null; render(); });
  }
  load().catch(function (e) {
    body.innerHTML = '<p class="muted">' + (e && e.status === 401 ? "Sign in to manage your profile." : "Could not load your profile.") + "</p>";
  });
})();
