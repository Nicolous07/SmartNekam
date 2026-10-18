// =====================================================================
// SMARTNEKAM LEARN - HARNESS (kodi inayoendeshwa ndani ya Web Worker)
// Faili hili halina React wala DOM, kwa hiyo scripts/verify-learn.mjs
// inaweza kulitumia kujaribu masomo yote nje ya browser.
// =====================================================================

export const PYODIDE_VERSION = '0.27.7'
export const PYODIDE_INDEX = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

// ---------- JavaScript ----------
// Inaendeshwa ndani ya worker: haina ufikiaji wa DOM wala cookies za app.
export const JS_WORKER_SRC = `
self.onmessage = function (e) {
  var code = e.data.code;
  var tests = e.data.tests;
  var out = [];
  var fmt = function (a) {
    if (typeof a === 'string') return a;
    try { return (typeof a === 'object' && a !== null) ? JSON.stringify(a) : String(a); }
    catch (_) { return String(a); }
  };
  var push = function (prefix) {
    return function () { out.push(prefix + Array.prototype.map.call(arguments, fmt).join(' ')); };
  };
  var cons = { log: push(''), info: push(''), warn: push('Onyo: '), error: push('Kosa: ') };
  var results = [];
  var check = function (name, fn) {
    try {
      var r = fn();
      results.push({ name: name, pass: r !== false });
    } catch (err) {
      results.push({ name: name, pass: false, msg: String((err && err.message) || err) });
    }
  };
  var error = null;
  try {
    var body = code + '\\n;' + (tests || '');
    new Function('console', 'check', '__out', body)(cons, check, function () { return out.join('\\n'); });
  } catch (err) {
    error = String((err && err.message) || err);
  }
  self.postMessage({ output: out.join('\\n'), error: error, results: tests ? results : undefined });
};
`

// ---------- Python (Pyodide) ----------
// Inaendeshwa kwenye namespace (dict) mpya kwa kila Run, ili mabadiliko yasidumu.
export const PY_PRELUDE = `
__results = []
__captured = ""
def check(name, fn):
    try:
        r = fn()
        __results.append({"name": name, "pass": r is not False})
    except Exception as e:
        __results.append({"name": name, "pass": False, "msg": (type(e).__name__ + ": " + str(e))})
def __out():
    return __captured
`

export const PY_WORKER_SRC = `
var PYODIDE_INDEX = ${JSON.stringify(PYODIDE_INDEX)};
var PRELUDE = ${JSON.stringify(PY_PRELUDE)};
var pyReady = null;

function getPy() {
  if (!pyReady) {
    importScripts(PYODIDE_INDEX + 'pyodide.js');
    pyReady = loadPyodide({ indexURL: PYODIDE_INDEX });
  }
  return pyReady;
}

function cleanError(msg) {
  var lines = String(msg).trim().split('\\n');
  var i = -1;
  for (var k = 0; k < lines.length; k++) {
    if (lines[k].indexOf('<exec>') !== -1) { i = k; break; }
  }
  if (i >= 0) return lines.slice(i).join('\\n');
  return lines.slice(-4).join('\\n');
}

self.onmessage = async function (e) {
  var d = e.data;
  try {
    var py = await getPy();
    if (d.packages && d.packages.length) { await py.loadPackage(d.packages); }
    self.postMessage({ type: 'started' });
    var buf = [];
    py.setStdout({ batched: function (s) { buf.push(s); } });
    py.setStderr({ batched: function (s) { buf.push(s); } });
    var ns = py.globals.get('dict')();
    py.runPython(PRELUDE, { globals: ns });
    var error = null;
    try {
      await py.runPythonAsync(d.code, { globals: ns });
    } catch (err) {
      error = cleanError((err && err.message) || err);
    }
    var captured = buf.join('\\n');
    var results;
    if (d.tests && !error) {
      ns.set('__captured', captured);
      try {
        py.runPython(d.tests, { globals: ns });
      } catch (err) {
        error = cleanError((err && err.message) || err);
      }
      results = ns.get('__results').toJs({ dict_converter: Object.fromEntries });
    }
    ns.destroy();
    self.postMessage({ type: 'done', output: captured, error: error, results: results });
  } catch (err) {
    self.postMessage({ type: 'fatal', message: String((err && err.message) || err) });
  }
};
`
