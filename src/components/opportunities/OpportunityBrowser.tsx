import Link from 'next/link'
import { Search, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import EmptyPanel from '@/components/layout/EmptyPanel'
import OpportunityCard from './OpportunityCard'
import {
  COVERAGE_TYPES,
  DEGREE_LEVELS,
  REGIONS,
  STUDY_FIELDS,
  type Opp,
} from '@/lib/opportunities'

export type FilterKey = 'level' | 'coverage' | 'field' | 'region' | 'remote'
export type OppSearchParams = Record<string, string | undefined>

const sel =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

const COLUMNS =
  'id, title, organization, type, deadline, region, degree_level, coverage_type, study_field, is_remote, apply_url'

function pick(list: readonly { key: string }[], value?: string) {
  return list.some((x) => x.key === value) ? (value as string) : ''
}

// Orodha ya fursa zilizochapishwa, zikiwa na vichujio na kitufe cha kuhifadhi.
export default async function OpportunityBrowser({
  tab,
  types,
  filters,
  sp,
  userId,
  emptyTitle,
}: {
  tab: string
  types: string[]
  filters: FilterKey[]
  sp: OppSearchParams
  userId: string
  emptyTitle: string
}) {
  const supabase = await createClient()

  const level = pick(DEGREE_LEVELS, sp.level)
  const coverage = pick(COVERAGE_TYPES, sp.coverage)
  const field = pick(STUDY_FIELDS, sp.field)
  const region = pick(REGIONS, sp.region)
  const remote = sp.remote === '1'
  const q = (sp.q ?? '').trim().slice(0, 80)

  let query = supabase
    .from('opportunities')
    .select(COLUMNS)
    .eq('is_published', true)
    .in('type', types)
    .order('deadline', { ascending: true, nullsFirst: false })
    .limit(60)

  if (filters.includes('level') && level) query = query.eq('degree_level', level)
  if (filters.includes('coverage') && coverage) query = query.eq('coverage_type', coverage)
  if (filters.includes('field') && field) query = query.eq('study_field', field)
  if (filters.includes('region') && region) query = query.eq('region', region)
  if (filters.includes('remote') && remote) query = query.eq('is_remote', true)
  if (q) query = query.or(`title.ilike.%${q.replace(/[%,()]/g, ' ')}%,organization.ilike.%${q.replace(/[%,()]/g, ' ')}%`)

  const { data, error } = await query
  const list = (data ?? []) as unknown as Opp[]

  const savedIds = new Set<string>()
  if (list.length > 0) {
    const { data: saved } = await supabase
      .from('opp_saved')
      .select('opportunity_id')
      .eq('user_id', userId)
    saved?.forEach((s) => savedIds.add(String(s.opportunity_id)))
  }

  const hasFilter = filters.length > 0

  return (
    <div className="space-y-4">
      {hasFilter && (
        <form action="/opportunities" method="get" className="geometric-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="tab" value={tab} />
          {filters.includes('level') && (
            <label className="text-xs font-semibold text-slate-500">
              Degree Level
              <select name="level" defaultValue={level} className={`${sel} mt-1`}>
                <option value="">Zote</option>
                {DEGREE_LEVELS.map((x) => (
                  <option key={x.key} value={x.key}>{x.label}</option>
                ))}
              </select>
            </label>
          )}
          {filters.includes('coverage') && (
            <label className="text-xs font-semibold text-slate-500">
              Coverage
              <select name="coverage" defaultValue={coverage} className={`${sel} mt-1`}>
                <option value="">Zote</option>
                {COVERAGE_TYPES.map((x) => (
                  <option key={x.key} value={x.key}>{x.label}</option>
                ))}
              </select>
            </label>
          )}
          {filters.includes('field') && (
            <label className="text-xs font-semibold text-slate-500">
              Field of Study
              <select name="field" defaultValue={field} className={`${sel} mt-1`}>
                <option value="">Zote</option>
                {STUDY_FIELDS.map((x) => (
                  <option key={x.key} value={x.key}>{x.label}</option>
                ))}
              </select>
            </label>
          )}
          {filters.includes('region') && (
            <label className="text-xs font-semibold text-slate-500">
              Country / Region
              <select name="region" defaultValue={region} className={`${sel} mt-1`}>
                <option value="">Zote</option>
                {REGIONS.map((x) => (
                  <option key={x.key} value={x.key}>{x.label}</option>
                ))}
              </select>
            </label>
          )}
          <label className="text-xs font-semibold text-slate-500">
            Tafuta
            <input name="q" defaultValue={q} placeholder="Jina au shirika..." className={`${sel} mt-1`} />
          </label>
          {filters.includes('remote') && (
            <label className="flex items-center gap-2 pt-5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <input type="checkbox" name="remote" value="1" defaultChecked={remote} className="h-4 w-4 accent-emerald-600" />
              Remote tu
            </label>
          )}
          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-500"
            >
              <Search className="h-4 w-4" /> Chuja
            </button>
            <Link href={`/opportunities?tab=${tab}`} className="text-sm font-semibold text-slate-500 hover:underline">
              Futa vichujio
            </Link>
          </div>
        </form>
      )}

      {error ? (
        <p className="geometric-card p-4 text-sm text-red-600">
          Imeshindikana kupakia: {error.message}. Hakikisha umeendesha supabase/opportunities.sql.
        </p>
      ) : list.length === 0 ? (
        <EmptyPanel
          icon={Sparkles}
          title={emptyTitle}
          text="Hakuna fursa zinazolingana. Jaribu kubadilisha vichujio, au rudi baadaye fursa mpya zikichapishwa."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((o) => (
            <OpportunityCard key={String(o.id)} o={o} saved={savedIds.has(String(o.id))} />
          ))}
        </ul>
      )}
    </div>
  )
}
