'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { GraduationCap, Loader2, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Institution = { id: string; name: string; region: string | null; country: string | null; school_type?: string | null; institution_type?: string | null; registration_status?: string | null; source_code?: string | null }

export default function InstitutionDirectory({ kind, title, description }: { kind: 'school' | 'tertiary'; title: string; description: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  useEffect(() => { setOffset(0) }, [query])

  useEffect(() => {
    let alive = true
    const timer = setTimeout(async () => {
      setLoading(true)
      const { data, error } = await supabase.rpc('search_smartnekam_institutions', {
        p_kind: kind === 'school' ? 'school' : 'tertiary',
        p_query: query.trim(),
        p_limit: 50,
        p_offset: offset,
      })
      if (!alive) return
      if (error) {
        setRows(offset ? (current) => current : [])
        setHasMore(false)
      } else {
        const next = ((data ?? []) as Array<{ id: string; name: string; region: string | null; country: string | null; institution_type: string | null; source_code: string | null; registration_status?: string | null }>).map((row) => ({
          ...row,
          school_type: kind === 'school' ? row.institution_type : null,
          institution_type: kind === 'tertiary' ? row.institution_type : null,
        })) as Institution[]
        setRows((current) => offset ? [...current, ...next.filter((item) => !current.some((old) => old.id === item.id))] : next)
        setHasMore(next.length === 50)
      }
      setLoading(false)
    }, query.trim().length ? 220 : 0)
    return () => { alive = false; clearTimeout(timer) }
  }, [query, offset, kind, supabase])

  return <section className="space-y-3">
    <div className="geometric-card p-4 sm:p-5"><h3 className="text-lg font-extrabold text-slate-950 dark:text-white">{title}</h3><p className="mt-1 text-sm text-slate-500">{description}</p>
      <label className="relative mt-3 block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={kind === 'school' ? 'Tafuta shule kwa jina au sehemu ya jina...' : 'Tafuta college, institute au university...'} className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label>
      <p className="mt-2 text-xs text-slate-500">{query.trim().length >= 2 ? `Matokeo yanayolingana na “${query.trim()}”` : 'Orodha kutoka kwenye taasisi zilizoingizwa. Tafuta kwa jina kupata matokeo zaidi.'}</p>
    </div>
    {rows.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map((item) => <article key={item.id} className="geometric-card flex min-w-0 items-center gap-3 p-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><GraduationCap className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h4 className="font-extrabold text-slate-950 dark:text-white">{item.name}</h4><p className="text-xs text-slate-500">{[item.region, kind === 'school' ? item.school_type : item.institution_type, item.registration_status].filter(Boolean).join(' · ') || 'Tanzania'}</p>{item.source_code && <p className="mt-0.5 truncate text-[10px] text-slate-400">{item.source_code}</p>}</div><Link href={`/communities/institution/${item.id}?kind=${kind}`} className="shrink-0 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white">Fungua</Link></article>)}</div> : !loading ? <div className="geometric-card p-8 text-center text-sm text-slate-500">Hakuna taasisi iliyoonekana. Jaribu kuandika jina kwa sehemu fupi, au hakikisha migration na import za taasisi zimekamilika.</div> : null}
    {loading && <p className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Inatafuta kwenye orodha...</p>}
    {!loading && hasMore && <button type="button" onClick={() => setOffset((current) => current + 50)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:border-emerald-500 dark:border-slate-700 dark:text-slate-200">Onyesha taasisi nyingine 50</button>}
  </section>
}
