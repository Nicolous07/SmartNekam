'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { COMBINATIONS, GRADE_POINTS, divisionOf } from '@/lib/opportunities'

export type Program = {
  id: string
  university: string
  program: string
  combinations: string[]
  min_points: number
  notes: string | null
}

const GRADES = ['A', 'B', 'C', 'D', 'E', 'S', 'F']
const sel =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

export default function CutoffCalculator({
  programs,
  tracked,
}: {
  programs: Program[]
  tracked: string[] // "university||program" tayari kwenye Kanban
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [combo, setCombo] = useState<string>('PCM')
  const [grades, setGrades] = useState<string[]>(['B', 'B', 'C'])
  const [added, setAdded] = useState<Set<string>>(new Set(tracked))
  const [busy, setBusy] = useState<string | null>(null)
  const [calculated, setCalculated] = useState(true)

  const total = grades.reduce((s, g) => s + (GRADE_POINTS[g] ?? 0), 0)

  const { eligible, near } = useMemo(() => {
    const fits = programs.filter(
      (p) => p.combinations.length === 0 || p.combinations.includes(combo)
    )
    // Pointi ndogo ni bora: unakidhi ukiwa na pointi sawa au pungufu ya kikomo cha kozi
    return {
      eligible: fits.filter((p) => total <= p.min_points),
      near: fits.filter((p) => total > p.min_points && total - p.min_points <= 2),
    }
  }, [programs, combo, total])

  const keyOf = (p: Program) => `${p.university}||${p.program}`

  async function addToWishlist(p: Program) {
    setBusy(p.id)
    const { error } = await supabase.from('opp_applications').insert({
      university: p.university,
      program: p.program,
      stage: total <= p.min_points ? 'requirements_met' : 'wishlist',
    })
    setBusy(null)
    if (!error) {
      setAdded((s) => new Set(s).add(keyOf(p)))
      router.refresh()
    }
  }

  const row = (p: Program, ok: boolean) => (
    <li key={p.id} className="flex items-start justify-between gap-3 rounded-lg bg-emerald-50 p-3 dark:bg-slate-800">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{p.program}</p>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {p.university} · Kikomo pointi {p.min_points}
          {!ok && ` (umezidi kwa ${total - p.min_points})`}
        </p>
        {p.notes && <p className="mt-0.5 text-xs text-slate-500">{p.notes}</p>}
      </div>
      {added.has(keyOf(p)) ? (
        <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-600">
          <CheckCircle2 className="h-4 w-4" /> Kwenye Kanban
        </span>
      ) : (
        <button
          type="button"
          disabled={busy === p.id}
          onClick={() => addToWishlist(p)}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Ongeza
        </button>
      )}
    </li>
  )

  return (
    <section className="geometric-card space-y-4 p-4">
      <div>
        <h2 className="font-heading text-lg font-bold text-slate-900 dark:text-slate-100">Cut-Off Calculator</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Chagua mchanganyiko na madaraja yako ya Form 6 (A=1, B=2, C=3, D=4, E=5, S=6, F=7; pointi ndogo ni bora).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs font-semibold text-slate-500">
          Combination
          <select value={combo} onChange={(e) => { setCombo(e.target.value); setCalculated(true) }} className={`${sel} block`}>
            {COMBINATIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        {grades.map((g, i) => (
          <label key={i} className="space-y-1 text-xs font-semibold text-slate-500">
            Somo {i + 1}
            <select
              value={g}
              onChange={(e) => setGrades((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
              className={`${sel} block`}
            >
              {GRADES.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
        ))}
        <div className="rounded-xl bg-emerald-600 px-4 py-2 text-white">
          <p className="text-[10px] font-semibold uppercase opacity-80">Pointi</p>
          <p className="text-xl font-extrabold leading-none">{total}</p>
        </div>
        <div className="rounded-xl bg-slate-900 px-4 py-2 text-white dark:bg-emerald-950">
          <p className="text-[10px] font-semibold uppercase opacity-80">Division yako</p>
          <p className="text-xl font-extrabold leading-none">{divisionOf(total).label}</p>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Division I: 3–9 · II: 10–12 · III: 13–17 · IV: 18–19 · 0: 20–21
      </p>

      {programs.length === 0 ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Bado hakuna kozi zilizoongezwa. Admin aongeze data rasmi (TCU/vyuo) kwenye jedwali la
          <code className="mx-1">opp_programs</code>; pointi zako zinahesabiwa tayari.
        </p>
      ) : (
        calculated && (
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                Unakidhi vigezo ({eligible.length})
              </h3>
              {eligible.length === 0 ? (
                <p className="text-sm text-slate-500">Hakuna kozi kwa pointi hizi.</p>
              ) : (
                <ul className="space-y-2">{eligible.map((p) => row(p, true))}</ul>
              )}
            </div>
            {near.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-100">Karibu kukidhi ({near.length})</h3>
                <ul className="space-y-2">{near.map((p) => row(p, false))}</ul>
              </div>
            )}
          </div>
        )
      )}
      <p className="text-xs text-slate-400">
        Matokeo ni mwongozo tu; thibitisha vigezo rasmi kwenye tovuti ya chuo / TCU.
      </p>
    </section>
  )
}
