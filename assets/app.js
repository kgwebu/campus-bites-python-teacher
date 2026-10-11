// Progress, menu, theme, search, confetti.
(function () {
  var KEY = "cb-progress-v1";
  var state = { done: {}, awards: {}, quiz: {}, badges: {}, xp: 0 };
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  try { var saved = JSON.parse(localStorage.getItem(KEY)); if (saved) for (var k in saved) state[k] = saved[k]; } catch (e) {}
  ["done", "awards", "quiz", "badges"].forEach(function (k) { if (!state[k] || typeof state[k] !== "object") state[k] = {}; });
  if (typeof state.xp !== "number" || !isFinite(state.xp)) state.xp = 0;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  var index = window.COURSE_INDEX || { chapters: [] };
  var pages = [];
  index.chapters.forEach(function (c) { c.lessons.forEach(function (l) { pages.push(l); }); if (c.quiz) pages.push(c.quiz); });

  // ----- confetti -----
  var canvas = $(".confetti"), parts = [], raf = null;
  function Celebrate(small) {
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var w = canvas.width = window.innerWidth, h = canvas.height = window.innerHeight;
    var n = small ? 40 : 160, colors = ["#c8553d", "#e9a23b", "#3f8f6b", "#4a7bd0", "#b0508f"];
    for (var i = 0; i < n; i++) parts.push({ x: w / 2 + (Math.random() - 0.5) * (small ? 120 : 300), y: small ? h * 0.65 : h * 0.4, vx: (Math.random() - 0.5) * (small ? 8 : 14), vy: -Math.random() * (small ? 9 : 14) - 3, s: 4 + Math.random() * 5, c: colors[i % colors.length], r: Math.random() * 6, life: 0 });
    if (!raf) raf = requestAnimationFrame(tick);
    function tick() {
      var ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, w, h);
      parts = parts.filter(function (p) { return p.life < 110; });
      parts.forEach(function (p) {
        p.life++; p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.r += 0.2;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - p.life / 110);
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore();
      });
      if (parts.length) raf = requestAnimationFrame(tick); else { raf = null; ctx.clearRect(0, 0, w, h); }
    }
  }
  window.Celebrate = Celebrate;

  // ----- modal -----
  var modal = $(".modal");
  var lastFocus = null;
  function closeModal() { if (!modal || modal.hidden) return; modal.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });
  function showModal(emoji, title, text) {
    if (!modal) return;
    lastFocus = document.activeElement;
    $(".modal-emoji", modal).textContent = emoji; $(".modal-title", modal).textContent = title; $(".modal-text", modal).textContent = text;
    modal.hidden = false; $(".modal-close", modal).focus(); Celebrate(false);
  }
  if (modal) { $(".modal-close", modal).addEventListener("click", closeModal); }

  // ----- progress API -----
  var Progress = {
    award: function (key, xp) { if (state.awards[key]) return; state.awards[key] = true; state.xp += xp; save(); refresh(); },
    markDone: function (id) { if (state.done[id]) return; state.done[id] = true; Progress.award(id + "#done", 10); save(); refresh(); },
    quiz: function (ch, score, total) {
      state.quiz[ch] = Math.max(state.quiz[ch] || 0, score);
      var pass = score >= Math.min(4, total);
      if (pass && !state.badges[ch]) {
        state.badges[ch] = true; Progress.award("badge" + ch, 50);
        var c = index.chapters.filter(function (x) { return x.n === ch; })[0];
        showModal(c ? c.emoji : "🏅", "Chapter " + ch + " badge earned!", (c ? c.title : "") + " — you scored " + score + "/" + total + ". +50 XP");
      }
      save(); refresh();
    },
    isDone: function (id) { return !!state.done[id]; },
    reset: function () { state = { done: {}, awards: {}, quiz: {}, badges: {}, xp: 0 }; save(); refresh(); }
  };
  window.Progress = Progress;

  function refresh() {
    var doneCount = pages.filter(function (p) { return state.done[p]; }).length;
    $$("[data-xp]").forEach(function (e) { e.textContent = state.xp; });
    $$("[data-badges]").forEach(function (e) { e.textContent = Object.keys(state.badges).length; });
    $$(".sidebar a[data-id]").forEach(function (a) { a.classList.toggle("done", !!state.done[a.getAttribute("data-id")]); });
    $$(".m-chap").forEach(function (d) {
      var n = parseInt(d.getAttribute("data-chapter"), 10);
      var c = index.chapters.filter(function (x) { return x.n === n; })[0];
      if (!c) return;
      var ids = c.lessons.concat(c.quiz ? [c.quiz] : []);
      var done = ids.filter(function (i) { return state.done[i]; }).length;
      $(".m-count", d).textContent = (state.badges[n] ? "🏅 " : "") + done + "/" + ids.length;
    });
    var pct = pages.length ? Math.round((doneCount / pages.length) * 100) : 0;
    var bar = $(".progress-bar span"); if (bar) bar.style.width = pct + "%";
    var txt = $(".progress-text"); if (txt) txt.textContent = doneCount + " of " + pages.length + " done";
    $$(".card[data-chapter]").forEach(function (card) {
      var n = parseInt(card.getAttribute("data-chapter"), 10);
      var c = index.chapters.filter(function (x) { return x.n === n; })[0];
      if (!c) return;
      var ids = c.lessons.concat(c.quiz ? [c.quiz] : []);
      var done = ids.filter(function (i) { return state.done[i]; }).length;
      var s = $(".card-bar span", card); if (s) s.style.width = (ids.length ? (done / ids.length) * 100 : 0) + "%";
      card.classList.toggle("complete", !!state.badges[n]);
    });
  }

  // ----- page wiring -----
  var pidNow = document.body.getAttribute("data-pid");
  var cur = $('.sidebar a[data-id="' + pidNow + '"]');
  if (cur) { cur.classList.add("current"); try { cur.scrollIntoView({ block: "center" }); } catch (e) {} }
  $$("[data-next]").forEach(function (a) {
    a.addEventListener("click", function () { if (document.body.getAttribute("data-kind") === "lesson") Progress.markDone(pidNow); });
  });

  var search = $(".search");
  if (search) search.addEventListener("input", function () {
    var q = search.value.trim().toLowerCase();
    $$(".m-chap, .m-sec").forEach(function (d) {
      var any = false;
      $$("li", d).forEach(function (li) {
        var show = !q || li.textContent.toLowerCase().indexOf(q) !== -1;
        li.hidden = !show; if (show) any = true;
      });
      d.hidden = !any; if (q && any) d.open = true;
    });
  });

  var tt = $(".theme-toggle");
  if (tt) tt.addEventListener("click", function () {
    var root = document.documentElement;
    var dark = root.getAttribute("data-theme") ? root.getAttribute("data-theme") === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    var next = dark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("cb-theme", next); } catch (e) {}
  });
  var mt = $(".menu-toggle");
  if (mt) mt.addEventListener("click", function () {
    var open = document.body.classList.toggle("menu-open");
    mt.setAttribute("aria-expanded", open ? "true" : "false");
  });
  var rp = $(".reset-progress");
  if (rp) rp.addEventListener("click", function () { if (window.confirm("Reset all your progress and XP?")) Progress.reset(); });

  // ----- present mode and answers toggle (teacher site) -----
  var pt = $(".present-toggle");
  if (pt) {
    var on = false;
    try { on = localStorage.getItem("cb-present") === "1"; } catch (e) {}
    var setPresent = function (v) {
      document.body.classList.toggle("present", v); pt.setAttribute("aria-pressed", v ? "true" : "false");
      try { localStorage.setItem("cb-present", v ? "1" : "0"); } catch (e) {}
    };
    setPresent(on);
    pt.addEventListener("click", function () { setPresent(!document.body.classList.contains("present")); });
  }
  var at = $(".answers-toggle");
  if (at) at.addEventListener("click", function () {
    var show = at.getAttribute("aria-pressed") !== "true";
    at.setAttribute("aria-pressed", show ? "true" : "false");
    $$(".answer").forEach(function (a) { a.hidden = !show; });
  });

  // ----- guide pages: Mac/Windows switch, ticks, downloadable files -----
  var osButtons = $$(".os-switch button");
  function setOS(v) {
    document.body.setAttribute("data-os", v);
    osButtons.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-os") === v ? "true" : "false"); });
    try { localStorage.setItem("cb-os", v); } catch (e) {}
  }
  var savedOS = null;
  try { savedOS = localStorage.getItem("cb-os"); } catch (e) {}
  if (savedOS !== "mac" && savedOS !== "win") savedOS = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "mac" : "win";
  if (osButtons.length) { setOS(savedOS); osButtons.forEach(function (b) { b.addEventListener("click", function () { setOS(b.getAttribute("data-os")); updateTicks(); }); }); }
  var ticks = {};
  try { ticks = JSON.parse(localStorage.getItem("cb-ticks") || "{}") || {}; } catch (e) { ticks = {}; }
  function visible(el) { return !!(el.offsetParent || el.getClientRects().length); }
  function updateTicks() {
    var boxes = $$("input[data-tick]").filter(visible);
    var sum = $(".tick-summary");
    if (sum && boxes.length) sum.textContent = boxes.filter(function (b) { return b.checked; }).length + " of " + boxes.length + " steps done";
  }
  $$("input[data-tick]").forEach(function (b) {
    b.checked = !!ticks[b.getAttribute("data-tick")];
    b.addEventListener("change", function () {
      if (b.checked) ticks[b.getAttribute("data-tick")] = true; else delete ticks[b.getAttribute("data-tick")];
      try { localStorage.setItem("cb-ticks", JSON.stringify(ticks)); } catch (e) {}
      updateTicks();
    });
  });
  updateTicks();
  $$(".file").forEach(function (f) {
    var text = function () { return $("code", f).textContent; };
    $(".dl-file", f).addEventListener("click", function () {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text()], { type: "text/plain" })); a.download = f.getAttribute("data-name");
      document.body.appendChild(a); a.click(); a.remove();
    });
    var cb = $(".copy-file", f);
    cb.addEventListener("click", function () {
      function done() { cb.textContent = "Copied!"; setTimeout(function () { cb.textContent = "Copy"; }, 1500); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text()).then(done, function () {});
    });
  });

  // ----- copy my progress -----
  function progressText() {
    var name = "";
    try { name = localStorage.getItem("cb-name") || ""; } catch (e) {}
    var labels = index.labels || {};
    var lines = ["Campus Bites Python — progress", "Name: " + (name || "(not given)"), "Date: " + new Date().toISOString().slice(0, 10),
      "XP: " + state.xp, "Badges: " + Object.keys(state.badges).sort().join(", ")];
    index.chapters.forEach(function (c) {
      var ids = c.lessons.concat(c.extras || [], c.quiz ? [c.quiz] : []);
      var done = ids.filter(function (i) { return state.done[i]; }).map(function (i) { return labels[i] || i; });
      lines.push("Class " + c.n + ": " + done.length + "/" + c.lessons.length + " done" + (done.length ? " (" + done.join(" ") + ")" : ""));
    });
    return lines.join("\n");
  }
  var cp = $(".copy-progress"), pm = $(".progress-modal");
  if (cp && pm) {
    var closePm = function () { pm.hidden = true; cp.focus(); };
    cp.addEventListener("click", function () {
      var nm = $(".pm-name", pm);
      try { nm.value = localStorage.getItem("cb-name") || ""; } catch (e) {}
      $(".pm-text", pm).value = progressText(); $(".pm-msg", pm).textContent = "";
      pm.hidden = false; nm.focus();
    });
    $(".pm-name", pm).addEventListener("input", function () {
      try { localStorage.setItem("cb-name", this.value.trim()); } catch (e) {}
      $(".pm-text", pm).value = progressText();
    });
    $(".pm-close", pm).addEventListener("click", closePm);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pm.hidden) closePm(); });
    $(".pm-copy", pm).addEventListener("click", function () {
      var ta = $(".pm-text", pm), msg = $(".pm-msg", pm);
      function fallback() { ta.select(); try { document.execCommand("copy"); msg.textContent = "Copied! Paste it in the chat."; } catch (e) { msg.textContent = "Press Ctrl+C (or Cmd+C) to copy."; } }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(function () { msg.textContent = "Copied! Paste it in the chat."; }, fallback);
      else fallback();
    });
  }

  refresh();
})();
