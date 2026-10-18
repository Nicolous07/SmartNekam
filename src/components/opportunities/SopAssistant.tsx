'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, Loader2, Sparkles } from 'lucide-react'
import { runSopAssistant, type SopInput } from '@/app/(app)/opportunities/sop-actions'
import { SOP_COST_POINTS } from '@/lib/opportunities'

export type SopHistory = { id: string; mode: string; title: string | null; output: string; created_at: string }

const f =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

export default function SopAssistant({ history, balance }: { history: SopHistory[]; balance: number }) {
  const [pending, start] = useTransition()
  const [mode, setMode] = useState<'draft' | 'review'>('draft')
  const [form, setForm] = useState<SopInput>({
    mode: 'draft', language: 'English', target: '', program: '', background: '', achievements: '', goals: '', existingText: '',
  })
  const [out, setOut] = useState('')
  const [error, setError] = useState('')
  const [bal, setBal] = useState(balance)
  const [copied, setCopied] = useState(false)

  const set = <K extends keyof SopInput>(k: K, v: SopInput[K]) => setForm((s) => ({ ...s, [k]: v }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setOut('')
    start(async () => {
      const res = await runSopAssistant({ ...form, mode })
      if (res.ok) {
        setOut(res.output)
        setBal(res.balance)
      } else setError(res.error)
    })
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div className="space-y-4">
      <section className="geometric-card space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-bold text-slate-900 dark:text-slate-100">AI Statement of Purpose</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Gharama: {SOP_COST_POINTS} PTS kwa kila matokeo yaliyofanikiwa. Salio: <b>{bal}</b>
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {([['draft', 'Andika rasimu mpya'], ['review', 'Hakiki rasimu yangu']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setMode(k)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${mode === k ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}>
              {l}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={f} value={form.target} onChange={(e) => set('target', e.target.value)} placeholder="Chuo / Scholarship unayoomba" />
            <input className={f} value={form.program} onChange={(e) => set('program', e.target.value)} placeholder="Kozi (mf. BSc Computer Science)" />
          </div>
          <select className={f} value={form.language} onChange={(e) => set('language', e.target.value as SopInput['language'])}>
            <option>English</option>
            <option>Kiswahili</option>
          </select>
          {mode === 'draft' ? (
            <>
              <textarea className={`${f} resize-none`} rows={3} value={form.background} onChange={(e) => set('background', e.target.value)} placeholder="Asili yako: shule, masomo, changamoto ulizopita..." />
              <textarea className={`${f} resize-none`} rows={3} value={form.achievements} onChange={(e) => set('achievements', e.target.value)} placeholder="Mafanikio/miradi/uongozi (ukweli tu)" />
              <textarea className={`${f} resize-none`} rows={2} value={form.goals} onChange={(e) => set('goals', e.target.value)} placeholder="Malengo yako baada ya masomo" />
            </>
          ) : (
            <textarea className={`${f} resize-none`} rows={8} value={form.existingText} onChange={(e) => set('existingText', e.target.value)} placeholder="Bandika rasimu yako hapa..." />
          )}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">{error}</p>}
          <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {pending ? 'Inaandika...' : `Tengeneza (${SOP_COST_POINTS} PTS)`}
          </button>
        </form>
      </section>

      {out && (
        <section className="geometric-card space-y-2 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-slate-100">Matokeo</h3>
            <button type="button" onClick={() => copy(out)} className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Imenakiliwa' : 'Nakili'}
            </button>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200">{out}</p>
          <p className="text-xs text-slate-400">Hariri na uongeze maelezo yako halisi kabla ya kutuma; ni rasimu ya kuanzia tu.</p>
        </section>
      )}

      {history.length > 0 && (
        <section className="geometric-card space-y-2 p-4">
          <h3 className="font-bold text-slate-900 dark:text-slate-100">Historia</h3>
          {history.map((h) => (
            <details key={h.id} className="rounded-lg bg-emerald-50 p-3 dark:bg-slate-800">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900 dark:text-slate-100">
                {h.mode === 'draft' ? 'Rasimu' : 'Uhakiki'} · {h.title ?? 'Bila jina'} ·{' '}
                <span className="font-normal text-slate-500">{new Date(h.created_at).toLocaleDateString('sw-TZ')}</span>
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{h.output}</p>
              <button type="button" onClick={() => copy(h.output)} className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Nakili</button>
            </details>
          ))}
        </section>
      )}
    </div>
  )
}
