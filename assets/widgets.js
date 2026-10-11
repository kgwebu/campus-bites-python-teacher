// Interactive pieces: editors, guess, fill, order, quiz, trace, slider, break.
(function () {
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function pid() { return document.body.getAttribute("data-pid") || "page"; }
  function award(key, xp) { if (window.Progress) window.Progress.award(pid() + "#" + key, xp); }
  function celebrate(small) { if (window.Celebrate) window.Celebrate(small); }

  function norm(s) {
    return String(s == null ? "" : s).replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
      .replace(/\r/g, "").trim().replace(/\s+/g, " ");
  }
  function sameAnswer(a, b, strict) {
    var x = norm(a), y = norm(b);
    if (x === y) return true;
    if (strict) return false;
    var strip = function (t) { return t.replace(/^["']|["']$/g, ""); };
    if (strip(x) === strip(y)) return true;
    var nx = Number(x), ny = Number(y);
    return x !== "" && y !== "" && !isNaN(nx) && !isNaN(ny) && nx === ny;
  }
  // ---- helpers for the student edition: answers are checked by hash, never shipped in plain text ----
  function sha256Hex(str) {
    var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var bytes = Array.prototype.slice.call(new TextEncoder().encode(str));
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (var sh = 56; sh >= 0; sh -= 8) bytes.push(sh >= 32 ? Math.floor(bitLen / Math.pow(2, sh)) & 0xff : (bitLen >>> sh) & 0xff);
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (var off = 0; off < bytes.length; off += 64) {
      var w = new Array(64);
      for (var i = 0; i < 16; i++) w[i] = (bytes[off + 4*i] << 24) | (bytes[off + 4*i + 1] << 16) | (bytes[off + 4*i + 2] << 8) | bytes[off + 4*i + 3];
      for (i = 16; i < 64; i++) {
        var s0 = rotr(w[i-15], 7) ^ rotr(w[i-15], 18) ^ (w[i-15] >>> 3);
        var s1 = rotr(w[i-2], 17) ^ rotr(w[i-2], 19) ^ (w[i-2] >>> 10);
        w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (x) { return ("00000000" + (x >>> 0).toString(16)).slice(-8); }).join("");
  }
  function hashText(salt, text) { return sha256Hex(salt + "|" + text); }
  function variants(s) {
    var x = norm(s), out = [x];
    var t = x.replace(/^["']/, "").replace(/["']$/, "");
    if (t !== x) out.push(t);
    var n = Number(x);
    if (x !== "" && isFinite(n)) { var c = String(n); if (out.indexOf(c) === -1) out.push(c); }
    return out;
  }
  function b64bytes(b64) { return Uint8Array.from(atob(b64), function (ch) { return ch.charCodeAt(0); }); }
  function b64text(b64) { return new TextDecoder().decode(b64bytes(b64)); }
  function storeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function storeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function openSealed(cls, code) {
    var blob = window.SEALED && window.SEALED[cls];
    if (!blob) return Promise.reject(new Error("These answers are not available on this page."));
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error("Your browser blocks unlocking on this kind of page. Open the course from its web address (https)."));
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveKey"]).then(function (mat) {
      return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64bytes(blob.s), iterations: blob.n, hash: "SHA-256" }, mat, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    }).then(function (key) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64bytes(blob.i) }, key, b64bytes(blob.d));
    }).then(function (plain) { return JSON.parse(new TextDecoder().decode(plain)); });
  }
  window.Seal = { sha256Hex: sha256Hex, hashText: hashText, variants: variants, norm: norm };

  function feedback(el, ok, text) {
    el.className = "fb " + (ok ? "good" : "bad");
    el.textContent = text;
  }
  function stdinOf(root) {
    var box = $(".stdin textarea", root);
    return box && box.value.trim() ? box.value.split("\n") : [];
  }

  // ---------- saved code: every editor remembers what the student typed (this browser only) ----------
  var CODE_PREFIX = "cb-code:";
  function pageId() { return document.body.getAttribute("data-pid") || location.pathname; }
  function editorIndex(ta) { return $$("textarea.code").indexOf(ta); }
  function codeKey(ta) { return CODE_PREFIX + pageId() + "#" + editorIndex(ta); }
  function exampleName(root, ta) {
    var kind = root.classList.contains("turn") ? "turn" : root.classList.contains("w-break") ? "break" : "try";
    var slug = pageId().split("/").pop();
    return slug + "-" + kind + (editorIndex(ta) + 1) + ".py";
  }
  function downloadText(name, text) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }
  window.CodeStore = { PREFIX: CODE_PREFIX, download: downloadText };

  // ---------- editors: Try it Yourself, Your turn, Break it ----------
  function wireEditor(root) {
    var ta = $("textarea.code", root);
    if (!ta) return;
    var stdinTa = $(".stdin textarea", root);
    var original = ta.getAttribute("data-original") || "";
    var key = codeKey(ta), saveTimer = null;
    function saveNow() {
      var changed = ta.value !== original;
      if (!changed) { try { localStorage.removeItem(key); } catch (e) {} return; }
      storeSet(key, JSON.stringify({ c: ta.value, s: stdinTa ? stdinTa.value : "", o: original, t: Date.now() }));
    }
    function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 350); }
    var restored = (function restore() {
      var raw = storeGet(key);
      if (!raw) return false;
      try {
        var rec = JSON.parse(raw);
        if (rec && rec.o === original && typeof rec.c === "string") {
          ta.value = rec.c;
          if (stdinTa && typeof rec.s === "string") stdinTa.value = rec.s;
          return true;
        } else localStorage.removeItem(key);   // the lesson changed since it was saved
      } catch (e) { try { localStorage.removeItem(key); } catch (x) {} }
      return false;
    })();
    // project steps start from the student's own code from the step before
    if (!restored && root._carry) { var carried = root._carry(); if (carried) ta.value = carried; }
    var out = $(".out", root);
    var stdinBox = $(".stdin", root);
    function syncStdin() { if (stdinBox && !stdinBox.classList.contains("quiet")) stdinBox.hidden = ta.value.indexOf("input(") === -1; }
    function grow() { ta.rows = Math.max(3, Math.min(18, ta.value.split("\n").length + 1)); }
    ta.addEventListener("input", function () { syncStdin(); grow(); saveSoon(); });
    if (stdinTa) stdinTa.addEventListener("input", saveSoon);
    window.addEventListener("pagehide", saveNow);
    var trapTab = true;
    ta.addEventListener("focus", function () { trapTab = true; });
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { trapTab = false; return; }
      if (e.key === "Tab") {
        if (e.shiftKey || !trapTab) return;
        e.preventDefault();
        var s = ta.selectionStart;
        ta.value = ta.value.slice(0, s) + "    " + ta.value.slice(ta.selectionEnd);
        ta.selectionStart = ta.selectionEnd = s + 4;
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        doRun();
      }
    });
    function doRun() {
      var btn = $(".run", root);
      if (btn) btn.disabled = true;
      return window.Runner.run(ta.value, out, { stdin: stdinOf(root), interactive: true, onWaiting: function (w) { if (btn) btn.disabled = w ? false : true; } }).then(function (r) {
        if (btn) btn.disabled = false;
        if (r.ok && root.classList.contains("try")) award("try" + indexOf(root), 2);
        return r;
      });
    }
    var run = $(".run", root); if (run) run.addEventListener("click", doRun);
    var reset = $(".reset", root);
    if (reset) reset.addEventListener("click", function () {
      ta.value = (root._carry && root._carry()) || ta.getAttribute("data-original") || "";
      if (stdinTa) stdinTa.value = stdinTa.defaultValue;
      out.innerHTML = ""; grow(); syncStdin(); saveNow();
    });
    var copy = $(".copy", root);
    if (copy) copy.addEventListener("click", function () {
      try { navigator.clipboard.writeText(ta.value); copy.textContent = "Copied!"; }
      catch (e) { ta.select(); copy.textContent = "Press Ctrl+C"; }
      setTimeout(function () { copy.textContent = "Copy"; }, 1500);
    });
    var btns = $(".try-btns", root) || $(".turn-btns", root);
    if (btns) {
      var dl = document.createElement("button");
      dl.type = "button"; dl.className = "btn ghost save-code"; dl.textContent = "⬇ Save";
      dl.title = "Download this code as a .py file";
      dl.addEventListener("click", function () { downloadText(exampleName(root, ta), ta.value.replace(/\s+$/, "") + "\n"); });
      btns.appendChild(dl);
    }
    syncStdin(); grow();
    root._run = doRun;
  }
  function indexOf(el) { return $$("." + el.className.split(" ")[0]).indexOf(el); }

  $$(".try, .w-break").forEach(wireEditor);

  // ---------- Your turn ----------
  // ---------- Project steps (student edition): one step at a time, the student's code carried forward ----------
  function stepRec(k) { try { return JSON.parse(storeGet("cb-step:" + pageId() + "#" + k)); } catch (e) { return null; } }
  function stepSave(k, code) { storeSet("cb-step:" + pageId() + "#" + k, JSON.stringify({ c: code })); }
  function carryFor(k) {
    var r = k > 1 ? stepRec(k - 1) : null;
    return r && typeof r.c === "string" ? r.c.replace(/\s+$/, "") + "\n\n# --- Step " + k + " ---\n" : "";
  }
  function openStep(k, focus) {
    var t = $('.turn[data-step="' + k + '"]'), lock = $('.step-lock[data-step="' + k + '"]');
    if (!t) return;
    t.hidden = false;
    if (lock) lock.hidden = true;
    if (t._applyCarry) t._applyCarry();
    if (focus) { try { t.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { t.scrollIntoView(); } }
  }

  $$(".turn").forEach(function (root) {
    var step = parseInt(root.getAttribute("data-step") || "0", 10), steps = parseInt(root.getAttribute("data-steps") || "0", 10);
    if (step > 1) root._carry = function () { return carryFor(step); };
    wireEditor(root);
    if (step > 1) {
      root._applyCarry = function () {
        var ta0 = $("textarea.code", root);
        if (!storeGet(codeKey(ta0))) { var c = carryFor(step); if (c) { ta0.value = c; ta0.dispatchEvent(new Event("input")); } }
      };
    }
    var gateHints = root.getAttribute("data-gate-hints") === "1";
    var answer = root.getAttribute("data-answer") || "";
    var fb = $(".fb", root), out = $(".out", root), ta = $("textarea.code", root);
    var hints = $$(".hint-step", root), shown = 0, hintBtn = $(".hint", root);
    if (hintBtn) hintBtn.addEventListener("click", function () {
      if (gateHints && fails < shown + 1) {
        feedback(fb, false, shown ? "Press Check again first. Another hint opens after another try." : "Give it a try and press Check first. Your first hint opens after one try.");
        return;
      }
      if (shown < hints.length) { hints[shown].hidden = false; shown++; }
      hintBtn.textContent = shown < hints.length ? "💡 Another hint (" + shown + "/" + hints.length + ")" : "💡 No more hints";
      if (shown >= hints.length) hintBtn.disabled = true;
    });
    var sealed = root.getAttribute("data-sealed") === "1";
    var fails = 0;
    function showAnswerText(text) {
      var pre = $(".answer", root);
      if (!pre) { pre = document.createElement("pre"); pre.className = "answer"; root.insertBefore(pre, $(".fb", root)); }
      pre.textContent = text; pre.hidden = false;
      var box = $(".unlock", root); if (box) box.hidden = true;
      if (step) { if (!stepRec(step)) stepSave(step, text); if (step < steps) openStep(step + 1, false); }
    }
    function cls() { return parseInt(document.body.getAttribute("data-class"), 10); }
    function tryUnlock(code, silent) {
      return openSealed(cls(), code.trim().toUpperCase()).then(function (answers) {
        storeSet("cb-code-" + cls(), code.trim().toUpperCase());
        showAnswerText(answers[root.getAttribute("data-aid")] || "(no answer found)");
        return true;
      }, function (err) {
        if (!silent) {
          var m = $(".unlock-msg", root);
          if (m) m.textContent = err && /browser|available/.test(err.message) ? err.message : "That code did not work. Check it with your teacher.";
        }
        return false;
      });
    }
    $(".show", root).addEventListener("click", function () {
      if (!sealed) { $(".answer", root).hidden = false; return; }
      var box = $(".unlock", root);
      var saved = storeGet("cb-code-" + cls());
      var go = saved ? tryUnlock(saved, true) : Promise.resolve(false);
      go.then(function (done) {
        if (done) return;
        box.hidden = false;
        box.innerHTML = '<label>Class code <input type="text" class="unlock-code" autocomplete="off" spellcheck="false" placeholder="ask your teacher"></label> <button type="button" class="btn unlock-go">Unlock</button><span class="unlock-msg" role="status"></span>';
        var inp = $(".unlock-code", box), msg = $(".unlock-msg", box);
        function submit() { msg.textContent = "Checking…"; tryUnlock(inp.value, false); }
        $(".unlock-go", box).addEventListener("click", submit);
        inp.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
        inp.focus();
      });
    });
    if (sealed) {
      var expectText = b64text(root.getAttribute("data-expect"));
      $(".check", root).addEventListener("click", function () {
        var btn = $(".check", root); btn.disabled = true;
        feedback(fb, true, "Checking…"); fb.className = "fb";
        window.Runner.run(ta.value, out, { stdin: stdinOf(root) }).then(function (mine) {
          btn.disabled = false;
          if (mine.offline) { feedback(fb, false, mine.err); return; }
          if (mine.timeout || mine.interrupted) { feedback(fb, false, "Your code did not finish. Look for a loop that never ends, then check again."); return; }
          if (!mine.ok) { feedback(fb, false, "Your code has an error. Fix it, then check again."); return; }
          if (norm(mine.out) === norm(expectText)) {
            feedback(fb, true, "🎉 Yes! Your output matches. Nice work.");
            award("turn" + indexOf(root), 10); celebrate(true);
            if (step) { stepSave(step, ta.value); if (step < steps) openStep(step + 1, true); }
            if (window.Progress && (!step || step === steps)) window.Progress.markDone(pid());
          } else {
            fails++;
            feedback(fb, false, fails >= 2 ? "Not quite yet. The output should look like this (the output, not the code):\n" + expectText.trim()
                                           : "Not quite yet. Read the task again, or open a hint.");
          }
        });
      });
      return;
    }
    $(".check", root).addEventListener("click", function () {
      var btn = $(".check", root); btn.disabled = true;
      feedback(fb, true, "Checking…"); fb.className = "fb";
      var stdin = stdinOf(root);
      Promise.all([window.Runner.run(ta.value, out, { stdin: stdin }), window.Runner.exec(answer, stdin)]).then(function (res) {
        btn.disabled = false;
        var mine = res[0], ref = res[1];
        if (mine.offline) { feedback(fb, false, mine.err); return; }
        if (mine.timeout || mine.interrupted) { feedback(fb, false, "Your code did not finish. Look for a loop that never ends, then check again."); return; }
        if (!mine.ok) { feedback(fb, false, "Your code has an error. Fix it, then check again."); return; }
        if (!ref.ok) { feedback(fb, false, "Sorry, we could not check this one. Compare your code with the answer instead."); return; }
        if (norm(mine.out) === norm(ref.out)) {
          feedback(fb, true, "🎉 Yes! Your output matches. Nice work.");
          award("turn" + indexOf(root), 10);
          celebrate(true);
          if (window.Progress) window.Progress.markDone(pid());
        } else {
          feedback(fb, false, "Not quite yet. Expected this output:\n" + (ref.out || "").trim());
        }
      });
    });
  });

  $$(".turn[data-step]").forEach(function (t) {
    var k = parseInt(t.getAttribute("data-step"), 10);
    if (k > 1 && stepRec(k - 1)) openStep(k, false);
  });

  // ---------- Guess first ----------
  $$(".w-guess").forEach(function (root, i) {
    var inp = $("input", root), out = $(".out", root), fb = $(".fb", root);
    $(".check", root).addEventListener("click", function () {
      if (!inp.value.trim()) { feedback(fb, false, "Type your guess first. Then Python will show what really happens."); return; }
      var hashes = root.getAttribute("data-hashes");
      var ok;
      if (hashes) {
        var list = JSON.parse(hashes), aid = root.getAttribute("data-aid");
        ok = variants(inp.value).some(function (v) { return list.indexOf(hashText(aid, v)) !== -1; });
      } else ok = sameAnswer(inp.value, root.getAttribute("data-answer"));
      feedback(fb, ok, ok ? "🎉 You guessed it!" : "Not quite. Let's see what Python really does.");
      if (ok) { award("guess" + i, 5); celebrate(true); }
      window.Runner.run(root.getAttribute("data-code"), out);
    });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") $(".check", root).click(); });
  });

  // ---------- Fill in the blank ----------
  $$(".w-fill").forEach(function (root, i) {
    var hashed = root.getAttribute("data-hashes"), aid = root.getAttribute("data-aid");
    var answers = hashed ? JSON.parse(hashed) : JSON.parse(root.getAttribute("data-answers"));
    function matches(b, k) {
      return hashed ? hashText(aid + "|" + k, norm(b.value)) === answers[k] : sameAnswer(b.value, answers[k], true);
    }
    var blanks = $$("input.blank", root), fb = $(".fb", root), out = $(".out", root);
    $(".check", root).addEventListener("click", function () {
      var good = blanks.every(matches);
      blanks.forEach(function (b, k) { b.classList.toggle("wrong", !matches(b, k)); b.classList.toggle("right", matches(b, k)); });
      feedback(fb, good, good ? "🎉 Correct! Here is what it does:" : "Not quite. Check the red blanks.");
      if (good) {
        award("fill" + i, 5); celebrate(true);
        var k = 0;
        var code = root.getAttribute("data-code").replace(/___/g, function () { return blanks[k++].value; });
        window.Runner.run(code, out);
      }
    });
  });

  // ---------- Put the lines in order ----------
  $$(".w-order").forEach(function (root, i) {
    var hashes = root.getAttribute("data-hashes") ? JSON.parse(root.getAttribute("data-hashes")) : null;
    var aid = root.getAttribute("data-aid");
    var lines = hashes ? JSON.parse(root.getAttribute("data-lines")) : root.getAttribute("data-code").split("\n");
    var list = $(".order-list", root), fb = $(".fb", root), out = $(".out", root);
    var items = [];
    function inOrder() {
      return hashes ? items.every(function (it, k) { return hashText(aid + "|" + k, it.text) === hashes[k]; })
                    : items.every(function (it, k) { return it.text === lines[k]; });
    }
    function shuffle() {
      items = lines.map(function (t, k) { return { text: t, id: k }; });
      var tries = 0;
      do {
        for (var a = items.length - 1; a > 0; a--) { var b = Math.floor(Math.random() * (a + 1)); var t = items[a]; items[a] = items[b]; items[b] = t; }
        tries++;
      } while (items.length > 1 && tries < 20 && items.every(function (it, k) { return it.text === lines[k]; }));
      draw();
    }
    function move(from, to, which) {
      if (to < 0 || to >= items.length) return;
      var it = items.splice(from, 1)[0]; items.splice(to, 0, it); draw();
      if (which) { var li = $$("li", list)[to]; var b = li && $("." + which, li); if (b) b.focus(); }
    }
    function draw() {
      list.innerHTML = "";
      items.forEach(function (it, k) {
        var li = document.createElement("li");
        li.draggable = true;
        li.innerHTML = '<span class="grip" aria-hidden="true">⠿</span><code></code><span class="mv"><button type="button" class="up" aria-label="Move up">▲</button><button type="button" class="dn" aria-label="Move down">▼</button></span>';
        $("code", li).textContent = it.text;
        $(".up", li).addEventListener("click", function () { move(k, k - 1, "up"); });
        $(".dn", li).addEventListener("click", function () { move(k, k + 1, "dn"); });
        li.addEventListener("dragstart", function (e) { e.dataTransfer.setData("text/plain", String(k)); li.classList.add("drag"); });
        li.addEventListener("dragend", function () { li.classList.remove("drag"); });
        li.addEventListener("dragover", function (e) { e.preventDefault(); });
        li.addEventListener("drop", function (e) { e.preventDefault(); move(parseInt(e.dataTransfer.getData("text/plain"), 10), k); });
        list.appendChild(li);
      });
    }
    $(".shuffle", root).addEventListener("click", function () { fb.className = "fb"; fb.textContent = ""; shuffle(); });
    $(".check", root).addEventListener("click", function () {
      var good = inOrder();
      feedback(fb, good, good ? "🎉 Perfect order! Here is what it prints:" : "Not quite. Think about what each line needs to exist first.");
      if (good) { award("order" + i, 5); celebrate(true); window.Runner.run(items.map(function (it) { return it.text; }).join("\n"), out); }
    });
    if (hashes) { items = lines.map(function (t, k) { return { text: t, id: k }; }); draw(); } else shuffle();
  });

  // ---------- Quiz ----------
  $$(".w-quiz").forEach(function (root, i) {
    var inChapter = !!root.closest(".chapter-quiz");
    var opts = $$(".opt", root), fb = $(".fb", root), locked = false;
    function isRight(btn) {
      var h = root.getAttribute("data-correct-h");
      return h ? btn.getAttribute("data-h") === h : btn.getAttribute("data-correct") === "1";
    }
    opts.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (locked) return;
        var ok = isRight(btn);
        btn.classList.add(ok ? "good" : "bad");
        var explain = root.getAttribute("data-explain");
        if (inChapter) {
          locked = true;
          opts.forEach(function (o) { o.disabled = true; if (isRight(o)) o.classList.add("good"); });
          feedback(fb, ok, (ok ? "✅ Correct. " : "❌ Not this time. ") + (explain || ""));
          root.dispatchEvent(new CustomEvent("answered", { bubbles: true, detail: { ok: ok } }));
        } else if (ok) {
          locked = true;
          opts.forEach(function (o) { o.disabled = true; });
          feedback(fb, true, "✅ Correct! " + (explain || ""));
          award("quiz" + i, 5); celebrate(true);
        } else {
          feedback(fb, false, "Not that one. Try again.");
        }
      });
    });
  });

  // ---------- Step through ----------
  $$(".w-trace").forEach(function (root) {
    var code = root.getAttribute("data-code"), lines = code.split("\n");
    var pre = $(".trace-code", root), boxes = $(".mem-boxes", root), outPre = $(".trace-out pre", root);
    var count = $(".trace-count", root), stepBtn = $(".step", root), backBtn = $(".back", root);
    var steps = null, idx = -1, loading = false;
    function drawCode(active) {
      pre.innerHTML = "";
      lines.forEach(function (t, k) {
        var d = document.createElement("div");
        d.className = "tl" + (active === k + 1 ? " active" : "");
        var n = document.createElement("span"); n.className = "ln"; n.textContent = k + 1;
        var c = document.createElement("span"); c.textContent = t || " ";
        d.appendChild(n); d.appendChild(c); pre.appendChild(d);
      });
    }
    function draw() {
      drawCode(idx >= 0 && steps && steps[idx] ? steps[idx].line : null);
      boxes.innerHTML = ""; outPre.textContent = "";
      if (idx < 0 || !steps) { count.textContent = "Press Start to begin"; backBtn.disabled = true; return; }
      var s = steps[idx], prev = idx > 0 ? steps[idx - 1].vars : {};
      var names = Object.keys(s.vars);
      if (!names.length) boxes.innerHTML = '<span class="muted">Nothing stored yet</span>';
      names.forEach(function (n) {
        var b = document.createElement("div");
        b.className = "mem-box" + (prev[n] !== s.vars[n] ? " changed" : "");
        b.innerHTML = '<span class="mem-name"></span><span class="mem-val"></span>';
        $(".mem-name", b).textContent = n; $(".mem-val", b).textContent = s.vars[n];
        boxes.appendChild(b);
      });
      outPre.textContent = s.out || "";
      var last = idx === steps.length - 1;
      count.textContent = last ? (s.error ? "Stopped: " + s.error : "Done! 🎉") : "About to run line " + s.line;
      stepBtn.textContent = last ? "Done" : "Next line ▶";
      stepBtn.disabled = last; backBtn.disabled = idx <= 0;
    }
    stepBtn.textContent = "Start ▶";
    stepBtn.addEventListener("click", function () {
      if (loading) return;
      if (!steps) {
        loading = true; count.textContent = "Starting Python…";
        window.Runner.trace(code).then(function (r) {
          loading = false; steps = r.steps || [];
          if (!steps.length) { count.textContent = "Could not start. Check your internet connection."; return; }
          idx = 0; draw(); award("trace", 3);
        });
      } else if (idx < steps.length - 1) { idx++; draw(); }
    });
    backBtn.addEventListener("click", function () { if (idx > 0) { idx--; draw(); } });
    $(".restart", root).addEventListener("click", function () { idx = steps ? 0 : -1; draw(); stepBtn.textContent = steps ? "Next line ▶" : "Start ▶"; });
    draw();
  });

  // ---------- Slider ----------
  $$(".w-slider").forEach(function (root) {
    var input = $("input[type=range]", root), val = $(".slider-val", root), out = $(".out", root);
    var name = root.getAttribute("data-slider-var"), code = root.getAttribute("data-code");
    var busy = false, dirty = false, started = false, timer = null;
    function go() {
      if (busy) { dirty = true; return; }
      busy = true;
      window.Runner.exec(name + " = " + input.value + "\n" + code).then(function (r) {
        busy = false;
        out.textContent = r.ok ? r.out.trim() : (r.err || "Error");
        if (dirty) { dirty = false; go(); }
      });
    }
    input.addEventListener("input", function () {
      val.textContent = input.value; award("slider", 3);
      clearTimeout(timer); timer = setTimeout(go, 80);
    });
    function kick() { if (!started) { started = true; out.textContent = "Starting Python…"; go(); } }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { kick(); io.disconnect(); } });
      io.observe(root);
    } else kick();
  });

  // ---------- Chapter quiz scoring ----------
  $$(".chapter-quiz").forEach(function (root) {
    var total = parseInt(root.getAttribute("data-total"), 10), score = 0, answered = 0;
    var box = $(".quiz-score", root), chapter = parseInt(root.getAttribute("data-chapter"), 10);
    root.addEventListener("answered", function (e) {
      answered++; if (e.detail.ok) score++;
      box.textContent = "Score: " + score + " / " + total + (answered < total ? " (" + (total - answered) + " to go)" : "");
      if (answered === total) {
        var pass = score >= Math.min(4, total);
        box.className = "quiz-score " + (pass ? "good" : "bad");
        box.textContent = pass ? "🏅 You scored " + score + "/" + total + " — chapter badge earned!" : "You scored " + score + "/" + total + ". Reload the page to try again, or revisit the lessons.";
        if (window.Progress) { window.Progress.quiz(chapter, score, total); window.Progress.markDone(pid()); }
      }
    });
  });
})();
