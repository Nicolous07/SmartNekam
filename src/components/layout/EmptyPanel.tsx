import type { LucideIcon } from 'lucide-react'

export default function EmptyPanel({
  icon: Icon,
  title,
  text,
  badge,
}: {
  icon: LucideIcon
  title: string
  text: string
  badge?: string
}) {
  return (
    <div className="geometric-card p-6 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <Icon className="h-6 w-6" />
      </span>
      {badge && (
        <p className="mt-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {badge}
        </p>
      )}
      <h3 className="mt-2 font-heading text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">{text}</p>
    </div>
  )
}
