'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, Plus, Trash2 } from 'lucide-react'

const STAGES = ['Naandaa', 'Nimetuma', 'Nasubiri jibu', 'Nimekubaliwa', 'Nimekataliwa']
const KEY = 'smartnekam-applications'

type Item = { id: string; name: string; stage: string }

// Hifadhi ni kwenye kivinjari cha mtumiaji huyu tu (localStorage). Haiendi kwenye database.
export default function ApplicationTracker() {
  const [items, setItems] = useState<Item[]>([])
  const [name, setName] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setItems(JSON.parse(raw) as Item[])
    } catch {
      // hakuna storage — endelea bila hifadhi
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(KEY, JSON.stringify(items))
    } catch {
      // ignore
    }
  }, [items, ready])

  function add() {
    const n = name.trim()
    if (!n) return
    setItems((prev) => [{ id: crypto.randomUUID(), name: n, stage: STAGES[0] }, ...prev])
    setName('')
  }

  return (
    <section className="geometric-card space-y-4 p-4">
      <h2 className="flex items-center gap-2 font-heading text-base font-bold text-slate-900 dark:text-slate-100">
        <ClipboardList className="h-5 w-5 text-emerald-600" /> Application Tracker
      </h2>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 80))}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Chuo / kozi unayoomba..."
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={add}
          disabled={!name.trim()}
          aria-label="Ongeza ombi"
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white transition hover:bg-emerald-500 disabled:opacity-40"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Bado hujaongeza maombi. Andika jina la chuo hapo juu.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 p-3 dark:bg-slate-800"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {it.name}
              </span>
              <select
                value={it.stage}
                onChange={(e) =>
                  setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, stage: e.target.value } : p)))
                }
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((p) => p.id !== it.id))}
                aria-label="Futa ombi"
                className="rounded-full p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-slate-400">Maombi yanahifadhiwa kwenye kifaa hiki tu.</p>
    </section>
  )
}
