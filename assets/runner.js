// Runs Python for the page. One shared worker, 10-second limit per run.
(function () {
  var MAX_LINES = 200;
  var TIMEOUT_MS = 10000;
  var worker = null, initPromise = null, seq = 0, pending = {};

  function abs(url) { return new URL(url, document.baseURI).href; }

  function post(msg, onStatus) {
    return new Promise(function (resolve) {
      var id = ++seq;
      pending[id] = { resolve: resolve, onStatus: onStatus };
      worker.postMessage(Object.assign({ id: id }, msg));
    });
  }

  function start() {
    var blob = new Blob([window.COURSE_WORKER], { type: "text/javascript" });
    worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = function (e) {
      var m = e.data, p = pending[m.id];
      if (!p) return;
      if (m.type === "status") { if (p.onStatus) p.onStatus(m.text); return; }
      delete pending[m.id];
      p.resolve(m);
    };
    worker.onerror = function () {
      Object.keys(pending).forEach(function (id) {
        pending[id].resolve({ type: "result", ok: false, fatal: true, err: "Python could not start.", out: "", images: [] });
        delete pending[id];
      });
    };
    initPromise = post({
      type: "init",
      cfg: { pyodideUrl: window.PYODIDE_URL, files: window.COURSE_DATA, prelude: window.COURSE_PRELUDE, tracer: window.COURSE_TRACER }
    });
  }

  function ensure(onStatus) {
    if (!worker) start();
    if (onStatus) onStatus("Starting Python… (first time only, a few seconds)");
    return initPromise.then(function (m) {
      if (m.type === "ready") return true;
      // start-up failed (for example no internet); allow a retry next time
      try { worker.terminate(); } catch (e) {}
      worker = null; initPromise = null;
      return false;
    });
  }

  var TIPS = [
    [/NameError/, "Python does not know this name. Check the spelling, or create the variable first."],
    [/IndentationError/, "Python cares about spaces at the start of a line. Line up the code and indent blocks by 4 spaces."],
    [/SyntaxError/, "Python could not read this line. Look for a missing quote, bracket, colon or a typo."],
    [/can only concatenate|unsupported operand/, "You mixed text and numbers. Turn one into the other with int(), float() or str()."],
    [/TypeError/, "A value is the wrong kind for this step. Check whether you are mixing text and numbers."],
    [/KeyError/, "That key is not in the dictionary. Check the spelling and the capital letters."],
    [/ZeroDivisionError/, "You cannot divide by zero. Check the number you are dividing by."],
    [/FileNotFoundError/, "Python cannot find that file. Check the file name and spelling."],
    [/ValueError/, "The value has the right type but the wrong content, like int('two')."],
    [/IndexError/, "That position is past the end of the list. Remember the first item is position 0."],
    [/AttributeError/, "This object does not have that name. Check the spelling after the dot."],
    [/EOFError/, "input() needs an answer. Type it in the 'Your answers' box under the code."]
  ];

  function friendly(err) {
    var last = String(err).trim().split("\n").pop();
    for (var i = 0; i < TIPS.length; i++) if (TIPS[i][0].test(err)) return TIPS[i][1];
    return last ? null : null;
  }

  function exec(code, stdin, onStatus) {
    if (location.protocol === "file:" && String(window.PYODIDE_URL).indexOf("file:") === 0) {
      return Promise.resolve({ ok: false, out: "", images: [], offline: true, err: "This offline copy needs a small local server. In the site folder run: python3 -m http.server  then open http://localhost:8000" });
    }
    return ensure(onStatus).then(function (ok) {
      if (!ok) return { ok: false, out: "", images: [], err: "Python could not load. Check your internet connection (it is needed the first time), then try again.", offline: true };
      var timer = null, finished = false;
      return new Promise(function (resolve) {
        post({ type: "run", code: code, stdin: stdin || [] }, function (text) {
          if (text === "exec-start") {
            if (onStatus) onStatus("");
            timer = setTimeout(function () {
              if (finished) return;
              finished = true;
              try { worker.terminate(); } catch (e) {}
              var waiting = pending;
              worker = null; initPromise = null; pending = {};
              // Anything queued behind this run will never finish: release it too.
              Object.keys(waiting).forEach(function (id) {
                waiting[id].resolve({ type: "result", ok: false, interrupted: true, out: "", images: [], err: "Another run was stopped, so this one was cancelled. Press Run again." });
              });
              resolve({ ok: false, timeout: true, out: "", images: [], err: "Your code ran for more than 10 seconds. Is there a loop that never ends?" });
            }, TIMEOUT_MS);
          } else if (onStatus) onStatus(text);
        }).then(function (m) {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          resolve(m);
        });
      });
    });
  }

  function trace(code) {
    return ensure().then(function (ok) {
      if (!ok) return { ok: false, steps: [] };
      return post({ type: "trace", code: code });
    });
  }

  function clip(text) {
    var lines = text.replace(/\n$/, "").split("\n");
    if (lines.length > MAX_LINES) return lines.slice(0, MAX_LINES).join("\n") + "\n… output shortened (" + (lines.length - MAX_LINES) + " more lines)";
    return lines.join("\n");
  }

  // Run code and show the result in an element.
  function run(code, outEl, opts) {
    opts = opts || {};
    outEl.innerHTML = "";
    outEl.classList.add("has-out");
    var status = document.createElement("span");
    status.className = "status";
    outEl.appendChild(status);
    return exec(code, opts.stdin, function (t) { status.textContent = t; }).then(function (r) {
      outEl.innerHTML = "";
      if (r.out) {
        var o = document.createElement("span");
        o.className = "stdout";
        o.textContent = clip(r.out);
        outEl.appendChild(o);
      }
      (r.images || []).forEach(function (b64) {
        var img = document.createElement("img");
        img.className = "plot";
        img.alt = "Chart produced by your code";
        img.src = "data:image/png;base64," + b64;
        outEl.appendChild(img);
      });
      if (r.err) {
        var e = document.createElement("span");
        e.className = "stderr";
        e.textContent = (r.out ? "\n" : "") + r.err;
        outEl.appendChild(e);
        var tip = friendly(r.err);
        if (tip) {
          var t = document.createElement("div");
          t.className = "tip";
          t.textContent = "💡 Tip: " + tip;
          outEl.appendChild(t);
        }
      }
      if (!r.out && !r.err && !(r.images || []).length) {
        var n = document.createElement("span");
        n.className = "muted";
        n.textContent = "(no output — add a print() to see something)";
        outEl.appendChild(n);
      }
      return r;
    });
  }

  window.Runner = { run: run, exec: exec, trace: trace, friendly: friendly };
})();
