import Link from 'next/link'

export type TabItem = { key: string; label: string }

// Tabs za ndani ya ukurasa (zinatumia ?tab=...). Zinafanya kazi kwenye server component.
export default function TabBar({
  base,
  tabs,
  active,
}: {
  base: string
  tabs: TabItem[]
  active: string
}) {
  return (
    <nav aria-label="Sehemu za ukurasa" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => {
        const on = t.key === active
        return (
          <Link
            key={t.key}
            href={`${base}?tab=${t.key}`}
            scroll={false}
            aria-current={on ? 'page' : undefined}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              on
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
