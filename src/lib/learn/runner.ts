'use client'

// Inaendesha kodi ya mwanafunzi ndani ya browser yake (Web Worker), si kwenye server yetu.
//  - JavaScript: worker ya kawaida (inakatwa baada ya sekunde 5 ikiwa kuna loop isiyoisha)
//  - Python: Pyodide (Python halisi iliyokusanywa kwa WebAssembly), inapakiwa mara ya kwanza tu
//  - HTML: inachanganuliwa na DOMParser, majaribio yanakagua muundo wa ukurasa
import { JS_WORKER_SRC, PY_WORKER_SRC } from './harness'
import type { Language } from './courses'

export type TestResult = { name: string; pass: boolean; msg?: string }
export type RunResult = {
  output: string
  error: string | null
  results?: TestResult[]
}

type Status = 'loading' | 'running'

const JS_TIMEOUT_MS = 5000
const PY_TIMEOUT_MS = 10000
const PY_LOAD_TIMEOUT_MS = 90000

let pyWorker: Worker | null = null

function makeWorker(src: string) {
  const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))
  const w = new Worker(url)
  URL.revokeObjectURL(url)
  return w
}

function runJavaScript(code: string, tests?: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const w = makeWorker(JS_WORKER_SRC)
    const timer = setTimeout(() => {
      w.terminate()
      resolve({
        output: '',
        error: 'Programu ilichukua muda mrefu (zaidi ya sekunde 5). Labda kuna loop isiyoisha.',
      })
    }, JS_TIMEOUT_MS)
    w.onmessage = (e: MessageEvent<RunResult>) => {
      clearTimeout(timer)
      w.terminate()
      resolve(e.data)
    }
    w.onerror = (e) => {
      clearTimeout(timer)
      w.terminate()
      resolve({ output: '', error: e.message || 'Kosa lisilojulikana.' })
    }
    w.postMessage({ code, tests })
  })
}

function runPython(
  code: string,
  tests: string | undefined,
  packages: string[] | undefined,
  onStatus?: (s: Status) => void
): Promise<RunResult> {
  return new Promise((resolve) => {
    if (!pyWorker) pyWorker = makeWorker(PY_WORKER_SRC)
    const w = pyWorker
    let timer: ReturnType<typeof setTimeout> | undefined

    const finish = (r: RunResult) => {
      if (timer) clearTimeout(timer)
      w.onmessage = null
      w.onerror = null
      resolve(r)
    }
    const kill = (msg: string) => {
      w.terminate()
      pyWorker = null // itaundwa upya kwenye Run ijayo (Pyodide imehifadhiwa na browser)
      finish({ output: '', error: msg })
    }

    onStatus?.('loading')
    timer = setTimeout(
      () => kill('Python imeshindwa kupakia. Hakikisha una intaneti kisha jaribu tena.'),
      PY_LOAD_TIMEOUT_MS
    )

    w.onmessage = (e: MessageEvent) => {
      const m = e.data
      if (m.type === 'started') {
        onStatus?.('running')
        if (timer) clearTimeout(timer)
        timer = setTimeout(
          () => kill('Programu ilichukua muda mrefu (zaidi ya sekunde 10). Labda kuna loop isiyoisha.'),
          PY_TIMEOUT_MS
        )
      } else if (m.type === 'done') {
        finish({ output: m.output, error: m.error, results: m.results })
      } else if (m.type === 'fatal') {
        kill(m.message)
      }
    }
    w.onerror = (e) => kill(e.message || 'Kosa la Python.')
    w.postMessage({ code, tests, packages })
  })
}

// HTML: majaribio yanaandikwa kama JavaScript yenye "doc" na "check".
function runHtml(code: string, tests?: string): RunResult {
  if (!tests) return { output: '', error: null }
  const doc = new DOMParser().parseFromString(code, 'text/html')
  const results: TestResult[] = []
  const check = (name: string, fn: () => unknown) => {
    try {
      results.push({ name, pass: fn() !== false })
    } catch (err) {
      results.push({ name, pass: false, msg: String((err as Error)?.message ?? err) })
    }
  }
  try {
    new Function('doc', 'check', tests)(doc, check)
  } catch (err) {
    return { output: '', error: String((err as Error)?.message ?? err), results }
  }
  return { output: '', error: null, results }
}

export async function runCode(opts: {
  language: Language
  code: string
  tests?: string
  packages?: string[]
  onStatus?: (s: Status) => void
}): Promise<RunResult> {
  const { language, code, tests, packages, onStatus } = opts
  if (language === 'javascript') return runJavaScript(code, tests)
  if (language === 'python') return runPython(code, tests, packages, onStatus)
  return runHtml(code, tests)
}
