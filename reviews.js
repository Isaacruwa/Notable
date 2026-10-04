/* Kiver community reviews: sign-in prompt, username claim, star rating form, edit and delete. */
(function () {
  "use strict";
  var box = document.getElementById("reviewBox");
  if (!box) return;
  var slug = box.getAttribute("data-slug") || "";
  var listEl = document.getElementById("reviewList");
  var sumEl = document.getElementById("reviewSummary");
  var countEl = document.getElementById("reviewCount");
  var BADGE = '<svg class="verified-badge user-verified" viewBox="0 0 18 18" width="16" height="16" role="img" aria-label="Verified user" xmlns="http://www.w3.org/2000/svg"><title>Verified</title><polygon fill="#0099FD" points="9,16 7.1,16.9 5.8,15.2 3.7,15.1 3.4,13 1.5,12 2.2,9.9 1.1,8.2 2.6,6.7 2.4,4.6 4.5,4 5.3,2 7.4,2.4 9,1.1 10.7,2.4 12.7,2 13.6,4 15.6,4.6 15.5,6.7 17,8.2 15.9,9.9 16.5,12 14.7,13 14.3,15.1 12.2,15.2 10.9,16.9"/><polygon fill="#FFFFFF" points="13.1,7.3 12.2,6.5 8.1,10.6 5.9,8.5 5,9.4 8,12.4"/></svg>';
  var state = { me: null, mine: null, isOwner: false, editing: false, rating: 0, checkSeq: 0, timer: null };

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function api(url, opts) {
    return fetch(url, opts || { credentials: "same-origin" }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error((d && d.error) || "Something went wrong. Please try again.");
        return d;
      });
    });
  }
  function post(body) {
    return api("/api/bots", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  function starRow(n) {
    n = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
    return '<span class="stars" role="img" aria-label="' + n + ' out of 5 stars">' + "\u2605".repeat(n) + '<span class="stars-off">' + "\u2605".repeat(5 - n) + "</span></span>";
  }
  function fmtDate(s) {
    try { return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return ""; }
  }
  function word(n) { return n + (n === 1 ? " review" : " reviews"); }

  function card(r) {
    return '<article class="review-card"><div class="review-head"><span class="review-avatar">' + esc((r.username || "K").charAt(0).toUpperCase()) + '</span><div class="review-who"><span class="review-name"><b>@' + esc(r.username || "kiver_user") + "</b>" + (r.verified ? BADGE : "") + "</span><small>" + esc(fmtDate(r.created_at)) + (r.edited ? " \u00b7 edited" : "") + "</small></div>" + starRow(r.rating) + "</div><p>" + esc(r.body) + "</p></article>";
  }
  function renderData(d) {
    var rows = (d && d.reviews) || [];
    var st = (d && d.stats) || { count: rows.length, average: 0 };
    if (listEl) listEl.innerHTML = rows.length ? rows.map(card).join("") : '<div class="empty-inline">No reviews yet. Be the first person to share an experience with this tool.</div>';
    if (sumEl) sumEl.innerHTML = st.count ? '<div class="review-summary"><b>' + esc(Number(st.average).toFixed(1)) + "</b>" + starRow(st.average) + "<small>" + word(st.count) + "</small></div>" : "";
    if (countEl) countEl.textContent = word(st.count || 0);
  }

  function loadAll() {
    var reviews = api("/api/bots?action=reviews&slug=" + encodeURIComponent(slug)).then(renderData).catch(function () {});
    var me = api("/api/me").then(function (m) {
      state.me = m;
      if (!m || !m.loggedIn) return;
      return api("/api/bots?action=myReview&slug=" + encodeURIComponent(slug)).then(function (x) {
        state.mine = (x && x.review) || null;
        state.isOwner = !!(x && x.isOwner);
      });
    }).catch(function () { state.me = { loggedIn: false }; });
    return Promise.all([reviews, me]).then(renderBox);
  }

  function setStatus(msg, ok) {
    var el = box.querySelector(".form-status");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "form-status" + (ok ? " ok" : "");
  }

  function renderBox() {
    var me = state.me;
    if (!me || !me.loggedIn) {
      box.innerHTML = '<div class="review-cta"><div><b>Used this tool?</b><p>Sign in to leave a review and help others decide.</p></div><a class="dark-button" href="/login.html?next=' + encodeURIComponent(location.pathname) + '">Sign in to review <span>\u2192</span></a></div>';
      return;
    }
    if (!me.username) { renderUsernameForm(); return; }
    if (state.isOwner) {
      box.innerHTML = '<div class="review-note">This is your listing, so you can\u2019t review it. Reviews from other people will show up below.</div>';
      return;
    }
    if (state.mine && !state.editing) {
      box.innerHTML = '<div class="review-mine"><div class="review-mine-head"><b>Your review</b>' + starRow(state.mine.rating) + "</div><p>" + esc(state.mine.body) + '</p><div class="review-form-foot"><button type="button" class="ghost-button" id="rvEdit">Edit</button><button type="button" class="ghost-button danger" id="rvDelete">Delete</button></div><p class="form-status" role="status"></p></div>';
      box.querySelector("#rvEdit").onclick = function () { state.editing = true; state.rating = Number(state.mine.rating) || 0; renderBox(); };
      box.querySelector("#rvDelete").onclick = function () {
        if (!window.confirm("Delete your review? This can\u2019t be undone.")) return;
        post({ action: "deleteReview", slug: slug }).then(function () { state.mine = null; state.editing = false; state.rating = 0; return loadAll(); }).catch(function (e) { setStatus(e.message); });
      };
      return;
    }
    renderForm();
  }

  function renderUsernameForm() {
    box.innerHTML = '<div class="review-form"><h3>Choose a username first</h3><p class="review-as">Your username appears next to your reviews. You can change it later.</p><form class="username-form" id="unForm" novalidate><input id="unInput" maxlength="20" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="e.g. alex_builds" aria-label="Username"><button class="dark-button" type="submit">Save username <span>\u2192</span></button></form><p class="username-hint" id="unHint">3 to 20 letters, numbers or underscores.</p><p class="form-status" role="status"></p></div>';
    var input = box.querySelector("#unInput"), hint = box.querySelector("#unHint"), form = box.querySelector("#unForm");
    input.addEventListener("input", function () {
      var v = input.value.trim().replace(/^@/, "");
      clearTimeout(state.timer);
      if (!v) { hint.className = "username-hint"; hint.textContent = "3 to 20 letters, numbers or underscores."; return; }
      var seq = ++state.checkSeq;
      state.timer = setTimeout(function () {
        api("/api/bots?action=checkUsername&username=" + encodeURIComponent(v)).then(function (r) {
          if (seq !== state.checkSeq) return;
          hint.className = "username-hint " + (r.available ? "ok" : "bad");
          hint.textContent = r.available ? "\u2713 @" + v + " is available" : (r.reason || "That username isn\u2019t available.");
        }).catch(function () {});
      }, 350);
    });
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var v = input.value.trim().replace(/^@/, "");
      if (!v) { setStatus("Enter a username."); return; }
      var btn = form.querySelector("button"); btn.disabled = true;
      post({ action: "setUsername", username: v }).then(function (r) {
        state.me.username = r.username; state.me.verified = !!r.verified; renderBox();
      }).catch(function (e) { btn.disabled = false; setStatus(e.message); });
    });
  }

  function renderForm() {
    var editing = !!state.mine;
    var who = '<p class="review-as">Posting as <b>@' + esc(state.me.username) + "</b>" + (state.me.verified ? BADGE : "") + "</p>";
    var btns = "";
    for (var i = 1; i <= 5; i++) btns += '<button type="button" class="star-btn" data-v="' + i + '" aria-label="' + i + (i === 1 ? " star" : " stars") + '" aria-pressed="false">\u2605</button>';
    box.innerHTML = '<form class="review-form" id="rvForm" novalidate><h3>' + (editing ? "Edit your review" : "Write a review") + "</h3>" + who + '<div class="star-input" role="group" aria-label="Your rating">' + btns + '</div><textarea id="rvBody" maxlength="1500" placeholder="What do you use it for? What works well, and what could be better?" aria-label="Your review"></textarea><div class="review-form-foot"><button class="dark-button" type="submit">' + (editing ? "Save changes" : "Post review") + ' <span>\u2192</span></button>' + (editing ? '<button type="button" class="ghost-button" id="rvCancel">Cancel</button>' : "") + '<span class="review-count" id="rvCount">0 / 1500</span></div><p class="form-status" role="status"></p></form>';
    var form = box.querySelector("#rvForm"), body = box.querySelector("#rvBody"), count = box.querySelector("#rvCount");
    var stars = box.querySelectorAll(".star-btn");
    function paint() { for (var k = 0; k < stars.length; k++) { var on = Number(stars[k].getAttribute("data-v")) <= state.rating; stars[k].classList.toggle("on", on); stars[k].setAttribute("aria-pressed", on ? "true" : "false"); } }
    for (var j = 0; j < stars.length; j++) stars[j].addEventListener("click", function (ev) { state.rating = Number(ev.currentTarget.getAttribute("data-v")); paint(); });
    if (editing) { body.value = state.mine.body || ""; if (!state.rating) state.rating = Number(state.mine.rating) || 0; }
    paint(); count.textContent = body.value.length + " / 1500";
    body.addEventListener("input", function () { count.textContent = body.value.length + " / 1500"; });
    var cancel = box.querySelector("#rvCancel");
    if (cancel) cancel.onclick = function () { state.editing = false; renderBox(); };
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var text = body.value.trim();
      if (!state.rating) { setStatus("Choose a star rating."); return; }
      if (text.length < 10) { setStatus("Write at least 10 characters."); return; }
      var btn = form.querySelector(".dark-button"); btn.disabled = true; setStatus("Saving\u2026", true);
      post({ action: "review", slug: slug, rating: state.rating, body: text }).then(function () {
        state.editing = false; state.rating = 0; return loadAll();
      }).catch(function (e) {
        btn.disabled = false;
        if (/username/i.test(e.message)) { state.me.username = null; renderBox(); return; }
        setStatus(e.message);
      });
    });
  }

  loadAll();
})();
