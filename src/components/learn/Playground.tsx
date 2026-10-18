'use client'

import { useState } from 'react'
import { Play, Loader2, Eraser } from 'lucide-react'
import CodeEditor from './CodeEditor'
import { runCode, type RunResult } from '@/lib/learn/runner'
import type { Language } from '@/lib/learn/courses'

const STARTERS: Record<Language, string> = {
  python: '# Andika Python hapa kisha bofya Run Code\nfor i in range(1, 6):\n    print("Habari", i)\n',
  javascript: '// Andika JavaScript hapa kisha bofya Run Code\nfor (let i = 1; i <= 5; i++) {\n  console.log("Habari " + i);\n}\n',
  html: '<h1>Habari Dunia</h1>\n<p>Hii ni ukurasa wangu wa kwanza.</p>\n<style>\n  h1 { color: seagreen; }\n</style>\n',
}

const LANGS: { key: Language; label: string }[] = [
  { key: 'python', label: 'Python' },
  { key: 'javascript', label: 'JavaScript' },
  { key: 'html', label: 'HTML/CSS' },
]

export default function Playground() {
  const [lang, setLang] = useState<Language>('python')
  const [codes, setCodes] = useState<Record<Language, string>>(STARTERS)
  const [data, setData] = useState(false) // pakia numpy/pandas
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('')
  const [result, setResult] = useState<RunResult | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  async function run() {
    setRunning(true)
    setResult(null)
    if (lang === 'html') setPreview(codes.html)
    try {
      const r = await runCode({
        language: lang,
        code: codes[lang],
        packages: lang === 'python' && data ? ['numpy', 'pandas'] : undefined,
        onStatus: (s) =>
          setStatus(
            s === 'loading'
              ? data
                ? 'Inapakia Python + pandas (inaweza kuchukua hadi sekunde 30 mara ya kwanza)...'
                : 'Inapakia Python (mara ya kwanza huchukua sekunde chache)...'
              : 'Inaendesha...'
          ),
      })
      setResult(r)
    } finally {
      setRunning(false)
      setStatus('')
    }
  }

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {LANGS.map((l) => (
          <button
            key={l.key}
            type="button"
            onClick={() => {
              setLang(l.key)
              setResult(null)
            }}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              lang === l.key
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <CodeEditor
        value={codes[lang]}
        onChange={(v) => setCodes((c) => ({ ...c, [lang]: v }))}
        language={lang}
        height="h-80"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-95 disabled:opacity-60"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run Code
        </button>
        <button
          type="button"
          onClick={() => setCodes((c) => ({ ...c, [lang]: STARTERS[lang] }))}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          <Eraser className="h-4 w-4" /> Rudisha mfano
        </button>
        {lang === 'python' && (
          <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-500">
            <input
              type="checkbox"
              checked={data}
              onChange={(e) => setData(e.target.checked)}
              className="accent-emerald-600"
            />
            Pakia numpy &amp; pandas (polepole zaidi)
          </label>
        )}
      </div>

      {status && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> {status}
        </p>
      )}

      {lang === 'html' && preview !== null && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
          <p className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900">
            Muonekano
          </p>
          <iframe title="Muonekano" sandbox="allow-scripts" srcDoc={preview} className="h-64 w-full bg-white" />
        </div>
      )}

      {result && lang !== 'html' && (
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
          <p className="border-b border-slate-800 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
            Matokeo (Console)
          </p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[13px] text-slate-100">
            {result.output || (result.error ? '' : '(hakuna matokeo ya kuonyesha)')}
            {result.error && <span className="text-red-400">{(result.output ? '\n' : '') + result.error}</span>}
          </pre>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Kodi inaendeshwa ndani ya browser yako tu; haitumwi kwenye server yetu. Python haisaidii <code>input()</code>.
      </p>
    </div>
  )
}
