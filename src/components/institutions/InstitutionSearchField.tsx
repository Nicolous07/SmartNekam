'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Loader2, Search, School, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type InstitutionKind = 'school' | 'tertiary'
type Institution = { id: string; name: string; region: string | null; country: string | null; school_type?: string | null; institution_type?: string | null; source_code?: string | null }

export default function InstitutionSearchField({
  kind,
  label,
  value,
  onChange,
  allowOther = false,
  placeholder,
  dark = false,
}: {
  kind: InstitutionKind
  label: string
  value: string
  onChange: (value: string) => void
  allowOther?: boolean
  placeholder?: string
  dark?: boolean
}) {
  const supabase = useMemo(() => createClient(), [])
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<Institution[]>([])
  const [selected, setSelected] = useState<Institution | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const table = kind === 'school' ? 'schools' : 'universities'
  const columns = kind === 'school' ? 'id,name,region,country,school_type,source_code' : 'id,name,region,country,institution_type,source_code'

  useEffect(() => {
    if (!value) {
      setSelected(null)
      return
    }
    if (value === '__other__') {
      setSelected(null)
      setQuery('')
      setOpen(false)
      return
    }
    let alive = true
    void supabase.from(table).select(columns).eq('id', value).maybeSingle().then(({ data }) => {
      if (!alive || !data) return
      const row = data as Institution
      setSelected(row)
      setQuery(row.name)
    })
    return () => { alive = false }
  }, [value, table, columns, supabase])

  useEffect(() => {
    if (!open || value === '__other__') return
    let alive = true
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const { data, error: queryError } = await supabase.rpc('search_smartnekam_institutions', {
          p_kind: kind === 'school' ? 'school' : 'tertiary',
          p_query: query.trim(),
          p_limit: 40,
          p_offset: 0,
        })
        if (!alive) return
        if (queryError) throw queryError
        setOptions(((data ?? []) as Array<{ id: string; name: string; region: string | null; country: string | null; institution_type: string | null; source_code: string | null }>).map((row) => ({
          ...row,
          school_type: kind === 'school' ? row.institution_type : null,
          institution_type: kind === 'tertiary' ? row.institution_type : null,
        })))
      } catch (err) {
        if (alive) {
          setOptions([])
          setError(err instanceof Error ? err.message : 'Imeshindikana kutafuta taasisi.')
        }
      } finally {
        if (alive) setLoading(false)
      }
    }, query.trim().length >= 2 ? 280 : 120)
    return () => { alive = false; clearTimeout(timer) }
  }, [query, open, value, table, columns, supabase])

  const darkInput = dark
    ? 'border-white/15 bg-[#121826] text-white placeholder:text-slate-500 focus:border-emerald-400'
    : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
  const panelClass = dark
    ? 'border-white/10 bg-[#101827] text-white'
    : 'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'

  return <div className="relative space-y-1.5">
    <label className={`block text-sm font-bold ${dark ? 'text-emerald-100' : 'text-slate-700 dark:text-slate-200'}`}>{label}</label>
    <div className="relative">
      <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${dark ? 'text-slate-400' : 'text-slate-500'}`} />
      <input
        type="search"
        value={value === '__other__' ? '' : query}
        onFocus={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); setSelected(null); onChange(''); setOpen(true) }}
        placeholder={value === '__other__' ? 'Umechagua kuandika jina mwenyewe' : placeholder || `Tafuta ${kind === 'school' ? 'shule' : 'chuo/college'} kwa jina...`}
        aria-label={label}
        aria-expanded={open}
        className={`w-full rounded-xl border py-3 pl-9 pr-10 text-sm outline-none ring-offset-1 transition focus:ring-2 focus:ring-emerald-500/20 ${darkInput}`}
      />
      {value && <button type="button" aria-label="Ondoa taasisi iliyochaguliwa" onClick={() => { onChange(''); setQuery(''); setSelected(null); setOpen(true) }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>}
      {!value && <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${dark ? 'text-slate-400' : 'text-slate-500'}`} />}
    </div>
    {value === '__other__' && <p className="text-xs text-amber-600 dark:text-amber-300">Taasisi haipo kwenye orodha; jaza jina kwenye sehemu iliyo chini.</p>}
    {selected && value !== '__other__' && <p className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300"><Check className="h-3.5 w-3.5" />{selected.name}{selected.region ? ` · ${selected.region}` : ''}</p>}
    {open && value !== '__other__' && <>
      <button type="button" aria-label="Funga matokeo ya utafutaji" onClick={() => setOpen(false)} className="fixed inset-0 z-20 cursor-default" />
      <div className={`absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border p-1.5 shadow-2xl ${panelClass}`}>
        <div className="flex items-center justify-between px-2 py-1.5 text-[11px] text-slate-500"><span>{query.trim().length >= 2 ? `Matokeo ya “${query.trim()}”` : 'Taasisi zilizopo — tafuta kwa jina'}</span>{loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}</div>
        {options.map((item) => <button type="button" key={item.id} onClick={() => { onChange(item.id); setSelected(item); setQuery(item.name); setOpen(false) }} className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2.5 text-left transition ${dark ? 'hover:bg-white/10' : 'hover:bg-emerald-50 dark:hover:bg-slate-800'}`}>
          <School className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.name}</span><span className="mt-0.5 block text-[11px] text-slate-500">{[item.region, item.country || 'Tanzania', item.school_type || item.institution_type].filter(Boolean).join(' · ')}</span></span>
        </button>)}
        {!loading && !options.length && <p className="px-3 py-4 text-center text-xs text-slate-500">Hakuna taasisi iliyopatikana kwa utafutaji huu.</p>}
        {allowOther && <button type="button" onClick={() => { onChange('__other__'); setQuery(''); setSelected(null); setOpen(false) }} className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-slate-200 px-2.5 py-3 text-left text-sm font-bold text-emerald-700 hover:bg-emerald-50 dark:border-slate-700 dark:text-emerald-300 dark:hover:bg-slate-800"><School className="h-4 w-4" />Taasisi yangu haipo kwenye orodha</button>}
        {error && <p className="px-3 py-2 text-xs text-red-500">{error}</p>}
      </div>
    </>}
  </div>
}
