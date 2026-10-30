'use client'

import { useMemo, useState } from 'react'
import { BookOpenCheck, HelpCircle, MessagesSquare, Users, UsersRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export type DailyAnalyticsRow = {
  day_date: string
  new_users: number | string
  new_study_groups: number | string
  new_chat_groups: number | string
  new_questions: number | string
  group_messages: number | string
}

type Metric = {
  key: keyof Omit<DailyAnalyticsRow, 'day_date'>
  label: string
  caption: string
  color: string
  icon: typeof Users
}

const metrics: Metric[] = [
  { key: 'new_users', label: 'Usajili mpya', caption: 'Watumiaji wapya', color: 'text-emerald-600 dark:text-emerald-400', icon: Users },
  { key: 'new_study_groups', label: 'Study Groups', caption: 'Vikundi vipya vya masomo', color: 'text-violet-600 dark:text-violet-400', icon: BookOpenCheck },
  { key: 'new_chat_groups', label: 'Chat Groups', caption: 'Makundi mapya ya chat', color: 'text-cyan-600 dark:text-cyan-400', icon: UsersRound },
  { key: 'new_questions', label: 'Maswali mapya', caption: 'Maswali yaliyowekwa', color: 'text-amber-600 dark:text-amber-400', icon: HelpCircle },
  { key: 'group_messages', label: 'Group messages', caption: 'Ujumbe wa vikundi kwa siku', color: 'text-emerald-700 dark:text-emerald-300', icon: MessagesSquare },
]

function ChartPanel({ rows, metric }: { rows: DailyAnalyticsRow[]; metric: Metric }) {
  const values = rows.map((row) => Number(row[metric.key] ?? 0))
  const total = values.reduce((sum, value) => sum + value, 0)
  const max = Math.max(1, ...values)
  const Icon = metric.icon
  const step = 284 / Math.max(rows.length - 1, 1)
  const barWidth = Math.max(3, Math.min(13, 252 / Math.max(rows.length, 1) - 3))

  return (
    <article className="geometric-card min-w-0 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-slate-950 dark:text-white">{metric.label}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{metric.caption}</p>
        </div>
        <span className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 ' + metric.color}>
          <Icon className="h-4 w-4"/>
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-2xl font-black tabular-nums text-slate-950 dark:text-white">{total.toLocaleString('en-US')}</p>
        <span className="text-[10px] font-semibold text-slate-400">{rows.length} days</span>
      </div>
      {rows.length ? <svg viewBox="0 0 320 104" role="img" aria-label={metric.label + ', jumla ' + total + ', trend ya siku ' + rows.length} className={'mt-2 h-24 w-full overflow-visible ' + metric.color}>
        <line x1="12" y1="80" x2="308" y2="80" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1"/>
        {rows.map((row, index) => {
          const value = Number(row[metric.key] ?? 0)
          const height = value === 0 ? 3 : Math.max(3, (value / max) * 58)
          const x = 18 + index * step
          const y = 78 - height
          return <rect key={row.day_date} x={Math.max(12, x - barWidth / 2)} y={y} width={barWidth} height={height} rx="3" fill="currentColor" opacity={index === rows.length - 1 ? 1 : 0.55}>
            <title>{row.day_date}: {value}</title>
          </rect>
        })}
        <text x="12" y="98" fontSize="9" fill="currentColor" opacity="0.7">{rows[0]?.day_date.slice(5)}</text>
        {rows.length > 2 && <text x="160" y="98" fontSize="9" textAnchor="middle" fill="currentColor" opacity="0.7">{rows[Math.floor(rows.length / 2)]?.day_date.slice(5)}</text>}
        <text x="308" y="98" fontSize="9" textAnchor="end" fill="currentColor" opacity="0.7">{rows[rows.length - 1]?.day_date.slice(5)}</text>
      </svg> : <p className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-700">Hakuna takwimu za kipindi hiki.</p>}
    </article>
  )
}

export default function AdminAnalyticsCharts({ initialData }: { initialData: DailyAnalyticsRow[] }) {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState(initialData)
  const [days, setDays] = useState('14')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function changeRange(nextDays: string) {
    setDays(nextDays)
    setLoading(true)
    setError('')
    try {
      const { data, error: queryError } = await supabase.rpc('admin_smartnekam_daily_analytics', { p_days: Number(nextDays) })
      if (queryError) {
        setError('Imeshindikana kupakia takwimu za kipindi hiki. Hakikisha migration 048 imeendeshwa kwenye database.')
      } else {
        setRows((data ?? []) as DailyAnalyticsRow[])
      }
    } catch {
      setError('Muunganisho umeshindikana. Jaribu tena baada ya muda mfupi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-3" aria-label="SmartNekam analytics trends">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-slate-950 dark:text-white">Growth & engagement trends</h3>
          <p className="mt-1 text-xs text-slate-500">Takwimu za jumla za database · saa za Tanzania</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
          Kipindi
          <select value={days} onChange={(event) => void changeRange(event.target.value)} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-900">
            <option value="7">Siku 7</option>
            <option value="14">Siku 14</option>
            <option value="30">Siku 30</option>
            <option value="90">Siku 90</option>
          </select>
        </label>
      </div>
      <div className={'grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ' + (loading ? 'opacity-60' : '')}>
        {metrics.map((metric) => <ChartPanel key={metric.key} rows={rows} metric={metric}/>)}
      </div>
      {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{error}</p>}
      <p className="text-[11px] leading-5 text-slate-500">Usajili ni profile records mpya; Study Groups na Chat Groups ni vikundi vilivyoundwa; Group messages ni idadi ya ujumbe usiofutwa kwenye group chats. Si kipimo cha watu walio online au active kipekee.</p>
    </section>
  )
}
