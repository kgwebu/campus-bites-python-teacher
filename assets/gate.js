// Release gate (student edition). A locked page holds its lesson encrypted. A typed release code opens it.
// The code chain must match tools/release.py: a later code is hashed down to get the earlier ones.
(function () {
  var R = window.RELEASE || { fps: [], pages: {} };
  var KEY = "cb-release";
  var ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var enc = new TextEncoder();
  var body = document.body;
  var idx = parseInt(body.getAttribute("data-rp") || "0", 10);
  var slot = document.querySelector(".release-slot");
  var panel = document.querySelector(".release-lock");

  function $(s, r) { return (r || document).querySelector(s); }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  function b64(s) { var raw = atob(s), a = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i); return a; }
  function norm(code) { return (code || "").toUpperCase().split("").filter(function (c) { return ALPHABET.indexOf(c) >= 0; }).join(""); }
  function sha(text) { return crypto.subtle.digest("SHA-256", enc.encode(text)); }
  function derive(code) {
    return sha(code).then(function (d) {
      return Array.prototype.slice.call(new Uint8Array(d), 0, 12).map(function (b) { return ALPHABET[b % 32]; }).join("");
    });
  }
  function deriveDown(code, steps) {
    var p = Promise.resolve(code);
    for (var i = 0; i < steps; i++) p = p.then(derive);
    return p;
  }
  function fingerprintIndex(code) {
    return sha("fp|" + code).then(function (d) { return R.fps.indexOf(hex(d)) + 1; }); // 0 means "no such code"
  }
  function decrypt(code, blob) {
    return crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveKey"]).then(function (base) {
      return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(blob.s), iterations: blob.n, hash: "SHA-256" }, base,
        { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    }).then(function (key) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(blob.i) }, key, b64(blob.d));
    }).then(function (plain) { return JSON.parse(new TextDecoder().decode(plain)); });
  }
  function stored() {
    try { var v = JSON.parse(localStorage.getItem(KEY)); if (v && v.i > 0 && v.c) return v; } catch (e) {}
    return null;
  }
  function remember(i, c) {
    var cur = stored();
    if (cur && cur.i >= i) return;
    try { localStorage.setItem(KEY, JSON.stringify({ i: i, c: c })); } catch (e) {}
  }

  function loadScripts(list, done) {
    var i = 0;
    (function next() {
      if (i >= list.length) { if (done) done(); return; }
      var s = document.createElement("script");
      s.src = list[i++];
      s.onload = next;
      s.onerror = next;
      document.body.appendChild(s);
    })();
  }

  function msg(text, bad) {
    var m = $(".rl-msg", panel);
    if (!m) return;
    m.textContent = text;
    m.className = "rl-msg" + (bad ? " bad" : "");
  }

  function wirePanel() {
    var input = $(".rl-input", panel), go = $(".rl-go", panel);
    function submit() {
      var code = norm(input.value);
      if (code.length !== 12) { msg("A release code has 12 letters and numbers. Check it and try again.", true); return; }
      if (!window.crypto || !crypto.subtle) { msg("This page needs https to unlock. Open the course from its web address.", true); return; }
      fingerprintIndex(code).then(function (j) {
        if (!j) { msg("That code is not right. Check it and try again.", true); return; }
        if (j < idx) { remember(j, code); msg("That code is for an earlier part. Ask for the newest code.", true); return; }
        remember(j, code);
        location.reload();
      });
    }
    go.addEventListener("click", submit);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  }

  function start() {
    var after = window.GATE_SCRIPTS || [];
    var blobEl = document.getElementById("gate-blob");
    var st = stored();
    if (!idx || !slot || !blobEl) { loadScripts(after); return; }
    function stayLocked() {
      if (panel) { panel.hidden = false; wirePanel(); }
      loadScripts(after);
    }
    if (!st || st.i < idx || !window.crypto || !crypto.subtle) { stayLocked(); return; }
    deriveDown(st.c, st.i - idx).then(function (code) {
      return decrypt(code, JSON.parse(blobEl.textContent));
    }).then(function (data) {
      slot.innerHTML = data.html;
      if (panel) panel.hidden = true;
      body.setAttribute("data-unlocked", "1");
      loadScripts(after);
    }).catch(function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      stayLocked();
    });
  }
  start();
})();
