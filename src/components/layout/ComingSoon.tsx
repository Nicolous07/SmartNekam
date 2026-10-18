import Link from 'next/link'
import { Sparkles, ArrowLeft } from 'lucide-react'
import PageHero from './PageHero'
import type { ImageKey } from '@/lib/images'

export default function ComingSoon({
  title,
  description,
  imageKey = 'library',
  tone = 'emerald',
}: {
  title: string
  description: string
  imageKey?: ImageKey
  tone?: 'emerald' | 'teal' | 'indigo' | 'amber'
}) {
  return (
    <div className="stagger mx-auto mt-2 max-w-3xl space-y-4">
      <PageHero title={title} subtitle={description} imageKey={imageKey} tone={tone} />
      <div className="geometric-card p-6 text-center">
        <div className="anim-float mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <Sparkles className="h-7 w-7" />
        </div>
        <p className="mt-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Inakuja hivi karibuni
        </p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Tunalijenga eneo hili sasa. Endelea kutumia Home kushiriki na wanafunzi wenzako wakati huo.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" /> Rudi Home
        </Link>
      </div>
    </div>
  )
}
