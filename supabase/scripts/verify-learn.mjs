// Inajaribu masomo yote ya kodi nje ya browser:
//   1) "solution" ya kila somo LAZIMA ipite majaribio yake yote
//   2) "starter" ya kila somo LAZIMA ishindwe angalau jaribio moja (isipite bila kazi)
//   3) slug ni za kipekee na quiz zina majibu halali
// Endesha:  node --experimental-strip-types scripts/verify-learn.mjs
// (HTML inahitaji jsdom: JSDOM_PATH=/njia/ya/node_modules/jsdom  - hiari)
import { spawnSync } from 'node:child_process'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { COURSES } from '../src/lib/learn/courses.ts'
import { JS_WORKER_SRC, PY_PRELUDE } from '../src/lib/learn/harness.ts'

let failures = 0
const fail = (m) => {
  failures++
  console.log('  ✗ ' + m)
}

function runJs(code, tests) {
  let msg
  const sandbox = { self: {}, console: {} }
  sandbox.self.postMessage = (m) => (msg = m)
  vm.createContext(sandbox)
  vm.runInContext(JS_WORKER_SRC, sandbox)
  sandbox.self.onmessage({ data: { code, tests } })
  return msg
}

function runPyBatch(jobs) {
  const script = `
import sys, json, io, contextlib
jobs = json.load(sys.stdin)
prelude = ${JSON.stringify(PY_PRELUDE)}
out = []
for job in jobs:
    ns = {}
    exec(prelude, ns)
    buf = io.StringIO()
    error = None
    with contextlib.redirect_stdout(buf):
        try:
            exec(job["code"], ns)
        except Exception as e:
            error = type(e).__name__ + ": " + str(e)
    results = []
    if not error:
        ns["__captured"] = buf.getvalue().rstrip("\\n")
        try:
            exec(job["tests"], ns)
        except Exception as e:
            error = "tests: " + type(e).__name__ + ": " + str(e)
        results = ns["__results"]
    out.append({"error": error, "results": results})
print(json.dumps(out))
`
  const r = spawnSync('python3', ['-I', '-c', script], { input: JSON.stringify(jobs), encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr)
  return JSON.parse(r.stdout)
}

let JSDOM = null
try {
  const req = createRequire(import.meta.url)
  JSDOM = req(process.env.JSDOM_PATH || 'jsdom').JSDOM
} catch {
  console.log('(jsdom haipo: masomo ya HTML yanaruka)')
}

function runHtml(code, tests) {
  const doc = new JSDOM(code).window.document
  const results = []
  const check = (name, fn) => {
    try {
      results.push({ name, pass: fn() !== false })
    } catch (e) {
      results.push({ name, pass: false, msg: String(e.message) })
    }
  }
  new Function('doc', 'check', tests)(doc, check)
  return { error: null, results }
}

const slugs = new Set()
const pyJobs = []
const pyMeta = []

for (const c of COURSES) {
  if (slugs.has(c.slug)) fail(`kozi slug imejirudia: ${c.slug}`)
  slugs.add(c.slug)
  const lessonSlugs = new Set()
  console.log(`${c.emoji} ${c.title} (${c.lessons.length} masomo)`)
  for (const l of c.lessons) {
    if (lessonSlugs.has(l.slug)) fail(`${c.slug}: somo slug imejirudia ${l.slug}`)
    lessonSlugs.add(l.slug)
    if (l.points < 1 || l.points > 50) fail(`${c.slug}/${l.slug}: points nje ya 1..50`)

    if (l.kind === 'quiz') {
      if (!l.quiz?.length) fail(`${c.slug}/${l.slug}: quiz haina maswali`)
      for (const q of l.quiz ?? []) {
        if (q.answer < 0 || q.answer >= q.options.length) fail(`${c.slug}/${l.slug}: answer batili "${q.q}"`)
        if (q.options.length < 2) fail(`${c.slug}/${l.slug}: options chache "${q.q}"`)
      }
      continue
    }

    if (!l.tests || !l.solution || l.starter === undefined) {
      fail(`${c.slug}/${l.slug}: somo la code linahitaji starter, tests na solution`)
      continue
    }

    for (const [which, code] of [['solution', l.solution], ['starter', l.starter]]) {
      if (l.language === 'javascript') {
        const r = runJs(code, l.tests)
        report(c, l, which, r)
      } else if (l.language === 'python') {
        pyJobs.push({ code, tests: l.tests })
        pyMeta.push({ c, l, which })
      } else if (l.language === 'html') {
        if (!JSDOM) continue
        report(c, l, which, runHtml(code, l.tests))
      }
    }
  }
}

function report(c, l, which, r) {
  const results = r.results ?? []
  const passed = results.filter((x) => x.pass).length
  const label = `${c.slug}/${l.slug} [${which}]`
  if (which === 'solution') {
    if (r.error || results.length === 0 || passed !== results.length) {
      fail(`${label}: ${passed}/${results.length} zimepita ${r.error ? '| kosa: ' + r.error : ''}`)
      results.filter((x) => !x.pass).forEach((x) => console.log(`      - ${x.name} ${x.msg ?? ''}`))
    } else console.log(`  ✓ ${label}: ${passed}/${results.length}`)
  } else {
    // starter lazima isipite yote
    if (!r.error && results.length > 0 && passed === results.length) fail(`${label}: starter tayari inapita majaribio yote!`)
  }
}

if (pyJobs.length) {
  const res = runPyBatch(pyJobs)
  res.forEach((r, i) => report(pyMeta[i].c, pyMeta[i].l, pyMeta[i].which, r))
}

console.log(failures ? `\n${failures} tatizo.` : '\nYote sawa ✅')
process.exit(failures ? 1 : 0)
