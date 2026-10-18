'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { Search, X, Loader2, BookOpen, Users, MessageSquare, Briefcase, GraduationCap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Result = {
  result_type: string
  result_id: string
  title: string
  summary: string | null
  level: string | null
  created_at: string | null
  relevance: number | null
  is_verified: boolean | null
}

const icons: Record<string, typeof BookOpen> = {
  notes: BookOpen,
  past_papers: BookOpen,
  study_groups: Users,
  questions: MessageSquare,
  courses: GraduationCap,
  opportunities: Briefcase,
  universities: GraduationCap,
  university_programmes: GraduationCap,
}
const typeLabels: Record<string, string> = {
  notes: 'Notes', past_papers: 'Past paper', study_groups: 'Study group',
  questions: 'Swali', courses: 'Kozi', opportunities: 'Fursa',
  universities: 'Chuo', university_programmes: 'Programu ya chuo',
}
function hrefFor(r: Result) {
  if (r.result_type === 'notes' || r.result_type === 'past_papers') return `/library/${r.result_id}?type=${r.result_type}`
  if (r.result_type === 'study_groups') return `/communities/room/${r.result_id}`
  if (r.result_type === 'questions') return `/communities/questions/${r.result_id}`
  if (r.result_type === 'courses') return `/learn/${r.result_id}`
  if (r.result_type === 'opportunities') return `/opportunities/${r.result_id}`
  if (r.result_type === 'universities' || r.result_type === 'university_programmes') return '/opportunities?tab=universities'
  return '/dashboard'
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const supabase = useMemo(() => createClient(), [])
  const inputRef = useRef<HTMLInputElement>(null)
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const q = term.trim()
    if (q.length < 2) { setResults([]); setSearched(''); setLoading(false); setError(null); return }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(async () => {
      const { data, error: rpcError } = await supabase.rpc('search_smartnekam', {
        p_query: q.slice(0, 120), p_limit: 12, p_type: null,
      })
      if (cancelled) return
      setResults((data ?? []) as Result[])
      setSearched(q)
      setError(rpcError?.message ?? null)
      setLoading(false)
    }, 320)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [term, supabase])

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[8vh]">
      <button type="button" aria-label="Funga utafutaji" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-label="Tafuta SmartNekam" className="geometric-card anim-sheet-up relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl">
        <div className="flex items-center gap-3 border-b border-emerald-100 px-4 dark:border-slate-800"><Search className="h-5 w-5 shrink-0 text-slate-400" /><input ref={inputRef} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Tafuta notes, maswali, kozi, vikundi au fursa..." className="w-full bg-transparent py-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100" />{loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : <button type="button" onClick={onClose} aria-label="Funga" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>}</div>
        <div className="max-h-[65vh] overflow-y-auto p-2">
          {term.trim().length < 2 && <p className="px-3 py-8 text-center text-sm text-slate-500">Andika angalau herufi 2 kutafuta.</p>}
          {error && <p className="m-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200">Utafutaji haukufanikiwa: {error}</p>}
          {term.trim().length >= 2 && !loading && !error && searched && results.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">Hakuna matokeo ya “{searched}”. Maudhui yataonekana yakishaongezwa na kuidhinishwa.</p>}
          <ul className="space-y-1">{results.map((r, i) => { const Icon = icons[r.result_type] ?? Search; return <li key={`${r.result_type}-${r.result_id}`} style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }} className="anim-fade-up"><Link href={hrefFor(r)} onClick={onClose} className="flex items-start gap-3 rounded-xl p-3 transition hover:bg-emerald-50 dark:hover:bg-slate-800"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-sm font-extrabold text-slate-950 dark:text-white">{r.title}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{typeLabels[r.result_type] ?? r.result_type}</span>{r.is_verified && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Verified</span>}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{r.summary || 'Fungua kuona maelezo zaidi.'}</span></span></Link></li>})}</ul>
        </div>
      </section>
    </div>, document.body,
  )
}

export default function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return <SearchPanel onClose={onClose} />
}
