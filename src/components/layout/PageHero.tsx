'use client'

import Image from 'next/image'
import { useDataSaver } from '@/components/data-saver/DataSaverProvider'
import { PAGE_IMAGES, type ImageKey } from '@/lib/images'

const TONES = {
  emerald: 'from-emerald-950/90 via-emerald-900/65 to-emerald-700/30',
  teal: 'from-teal-950/90 via-teal-900/65 to-teal-700/30',
  indigo: 'from-indigo-950/90 via-indigo-900/65 to-indigo-700/30',
  amber: 'from-amber-950/90 via-amber-900/65 to-amber-700/30',
} as const

// Bango la picha lenye maandishi juu yake. Linatumia animation za globals.css (anim-*).
export default function PageHero({
  title,
  subtitle,
  imageKey,
  tone = 'emerald',
  children,
}: {
  title: string
  subtitle?: string
  imageKey: ImageKey
  tone?: keyof typeof TONES
  children?: React.ReactNode
}) {
  const img = PAGE_IMAGES[imageKey]
  const { lowDataMode } = useDataSaver()
  return (
    <section className="geometric-hero img-zoom relative min-h-44 rounded-2xl text-white sm:min-h-56" data-low-data-mode={lowDataMode}>
      {<Image
        src={img.src}
        alt=""
        fill
        sizes="(min-width: 1152px) 1152px, 100vw"
        className="anim-ken-burns object-cover"
        style={{ objectPosition: img.position }}
      />}
      <div className={`absolute inset-0 bg-gradient-to-r ${TONES[tone]}`} />
      <div className="relative flex min-h-44 flex-col justify-end p-6 sm:min-h-56 sm:p-8">
        <h1 className="anim-fade-up text-2xl font-extrabold sm:text-4xl">{title}</h1>
        {subtitle && (
          <p className="anim-fade-up anim-delay-2 mt-2 max-w-xl text-sm text-emerald-50 sm:text-base">
            {subtitle}
          </p>
        )}
        {children && <div className="anim-fade-up anim-delay-3 mt-4">{children}</div>}
      </div>
    </section>
  )
}
