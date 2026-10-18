import Link from 'next/link'
import { Clock, Globe2, Laptop } from 'lucide-react'
import SaveButton from './SaveButton'
import {
  COVERAGE_TYPES,
  DEGREE_LEVELS,
  REGIONS,
  TYPE_LABELS,
  countdownText,
  daysLeft,
  labelFrom,
  type Opp,
} from '@/lib/opportunities'

export default function OpportunityCard({ o, saved }: { o: Opp; saved: boolean }) {
  const days = daysLeft(o.deadline)
  const urgent = days !== null && days >= 0 && days <= 7
  const expired = days !== null && days < 0

  return (
    <li className="geometric-card hover-lift relative">
      <Link href={`/opportunities/${o.id}`} className="block p-4 pr-14">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {TYPE_LABELS[o.type] ?? o.type}
          </span>
          {o.coverage_type && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {labelFrom(COVERAGE_TYPES, o.coverage_type)}
            </span>
          )}
          {o.degree_level && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {labelFrom(DEGREE_LEVELS, o.degree_level)}
            </span>
          )}
          {o.is_remote && (
            <span className="flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
              <Laptop className="h-3 w-3" /> Remote
            </span>
          )}
        </div>

        <p className="mt-2 font-bold text-slate-900 dark:text-slate-100">{o.title}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">{o.organization}</p>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          {o.region && (
            <span className="flex items-center gap-1">
              <Globe2 className="h-3.5 w-3.5" /> {labelFrom(REGIONS, o.region)}
            </span>
          )}
          {days !== null && (
            <span
              className={`flex items-center gap-1 font-semibold ${
                expired ? 'text-slate-400' : urgent ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              <Clock className="h-3.5 w-3.5" /> {countdownText(days)}
            </span>
          )}
        </div>
      </Link>
      <div className="absolute right-3 top-3">
        <SaveButton oppId={o.id} saved={saved} />
      </div>
    </li>
  )
}
