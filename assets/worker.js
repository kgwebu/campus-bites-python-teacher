// Runs Python in a Web Worker so a runaway loop can be stopped.
let pyodide = null;
let ready = null;

async function init(cfg) {
  importScripts(cfg.pyodideUrl + "pyodide.js");
  pyodide = await loadPyodide({ indexURL: cfg.pyodideUrl });
  for (const name of Object.keys(cfg.files)) pyodide.FS.writeFile(name, cfg.files[name]);
  pyodide.runPython(cfg.prelude);
  pyodide.runPython(cfg.tracer);
}

function cleanTraceback(msg) {
  const lines = String(msg).split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/File "\/lib\/python[^"]*", line/.test(line) || /File "\/lib\/pyodide/.test(line) || /_pyodide\//.test(line)) {
      if (i + 1 < lines.length && /^\s{4}\S/.test(lines[i + 1])) i++;
      continue;
    }
    const m = line.match(/^\s*File "<exec>", line (\d+)(?:, in (.*))?$/);
    if (m) {
      out.push("  Line " + m[1] + (m[2] && m[2] !== "<module>" ? " (in " + m[2] + ")" : ""));
      continue;
    }
    out.push(line);
  }
  return out.join("\n").trim();
}

// Handle one message at a time so two runs never share stdout.
let queue = Promise.resolve();
onmessage = (e) => { queue = queue.then(() => handle(e.data)); };

async function handle(m) {
  try {
    if (m.type === "init") {
      ready = init(m.cfg);
      await ready;
      postMessage({ id: m.id, type: "ready" });
      return;
    }
    await ready;
    if (m.type === "run") {
      let out = "";
      let err = "";
      pyodide.setStdout({ batched: (s) => { out += s + "\n"; } });
      pyodide.setStderr({ batched: (s) => { err += s + "\n"; } });
      let images = [];
      let fail = null;
      try {
        // Look at the real import lines, not at words inside strings or comments.
        let imported = [];
        try {
          const found = pyodide.pyimport("pyodide.code").find_imports(m.code);
          imported = found.toJs();
          found.destroy();
        } catch (e) { imported = []; }
        if (imported.indexOf("matplotlib") !== -1 || imported.indexOf("pandas") !== -1) {
          postMessage({ id: m.id, type: "status", text: "Loading data tools… (first time can take a little while)" });
        }
        await pyodide.loadPackagesFromImports(m.code);
        if (imported.indexOf("matplotlib") !== -1) pyodide.runPython("import matplotlib\nmatplotlib.use('AGG')");
        pyodide.globals.set("_answers", pyodide.toPy(m.stdin || []));
        pyodide.runPython("import builtins\nbuiltins.input = _make_input(list(_answers))");
        postMessage({ id: m.id, type: "status", text: "exec-start" });
        const g = pyodide.globals.get("dict")();
        g.set("__name__", "__main__");
        try {
          await pyodide.runPythonAsync(m.code, { globals: g });
        } finally {
          g.destroy();
        }
        const figs = pyodide.runPython("_grab_figures()");
        images = figs.toJs();
        figs.destroy();
      } catch (ex) {
        fail = cleanTraceback(ex.message || ex);
      }
      postMessage({ id: m.id, type: "result", ok: fail === null, out: out, err: (fail || "") + (err && fail === null ? err : ""), images: images });
      return;
    }
    if (m.type === "trace") {
      pyodide.globals.set("_trace_src", m.code);
      const json = pyodide.runPython("_trace_run(_trace_src)");
      postMessage({ id: m.id, type: "result", ok: true, steps: JSON.parse(json) });
      return;
    }
  } catch (ex) {
    postMessage({ id: m.id, type: "result", ok: false, out: "", err: String(ex && ex.message ? ex.message : ex), images: [], fatal: true });
  }
}
