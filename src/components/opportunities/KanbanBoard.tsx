'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Loader2, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { STAGES } from '@/lib/opportunities'

export type AppItem = { id: string; university: string; program: string | null; stage: string }

const inp =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

export default function KanbanBoard({ items }: { items: AppItem[] }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [uni, setUni] = useState('')
  const [prog, setProg] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (uni.trim().length < 2) return setError('Andika jina la chuo.')
    setBusy('add')
    setError('')
    const { error: err } = await supabase
      .from('opp_applications')
      .insert({ university: uni.trim(), program: prog.trim() || null })
    setBusy(null)
    if (err) return setError('Imeshindikana kuongeza.')
    setUni('')
    setProg('')
    router.refresh()
  }

  async function move(item: AppItem, dir: -1 | 1) {
    const idx = STAGES.findIndex((s) => s.key === item.stage)
    const next = STAGES[idx + dir]
    if (!next) return
    setBusy(item.id)
    await supabase
      .from('opp_applications')
      .update({ stage: next.key, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    setBusy(null)
    router.refresh()
  }

  async function remove(item: AppItem) {
    if (!window.confirm(`Ondoa ${item.university}?`)) return
    setBusy(item.id)
    await supabase.from('opp_applications').delete().eq('id', item.id)
    setBusy(null)
    router.refresh()
  }

  return (
    <section className="geometric-card space-y-4 p-4">
      <h2 className="font-heading text-lg font-bold text-slate-900 dark:text-slate-100">Application Tracker</h2>

      <form onSubmit={add} className="flex flex-wrap gap-2">
        <input value={uni} onChange={(e) => setUni(e.target.value.slice(0, 120))} placeholder="Chuo (mf. UDSM)" className={`${inp} min-w-0 flex-1`} />
        <input value={prog} onChange={(e) => setProg(e.target.value.slice(0, 120))} placeholder="Kozi (hiari)" className={`${inp} min-w-0 flex-1`} />
        <button type="submit" disabled={busy === 'add'} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
          {busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ongeza
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((s, si) => {
          const col = items.filter((i) => i.stage === s.key)
          return (
            <div key={s.key} className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900">
              <p className="px-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                {s.label} <span className="text-slate-400">({col.length})</span>
              </p>
              <p className="mb-2 px-1 text-[11px] text-slate-500">{s.hint}</p>
              <ul className="space-y-2">
                {col.map((i) => (
                  <li key={i.id} className="rounded-lg border border-emerald-100 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{i.university}</p>
                    {i.program && <p className="text-xs text-slate-500">{i.program}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex gap-1">
                        <button type="button" aria-label="Rudisha nyuma" disabled={si === 0 || busy === i.id} onClick={() => move(i, -1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-700">
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                        <button type="button" aria-label="Peleka mbele" disabled={si === STAGES.length - 1 || busy === i.id} onClick={() => move(i, 1)} className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-30 dark:hover:bg-slate-700">
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                      <button type="button" aria-label="Ondoa" onClick={() => remove(i)} className="rounded p-1 text-slate-400 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
