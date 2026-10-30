'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, BookOpen, BriefcaseBusiness, Library, Users } from 'lucide-react'

type DiscoveryFeatureCardProps = {
  href: string
  title: string
  subtitle: string
  image: string
  iconName: 'library' | 'book' | 'users' | 'briefcase'
  accent: string
}

const FALLBACK_IMAGE = '/images/hero-desk.jpg'
const FEATURE_ICONS = {
  library: Library,
  book: BookOpen,
  users: Users,
  briefcase: BriefcaseBusiness,
} as const

/**
 * Feature discovery card. Uses a non-negative stacking order so the image is
 * always above the card background, and falls back to a known local asset if
 * an individual image is missing or fails to load on a device/deployment.
 */
export default function DiscoveryFeatureCard({
  href,
  title,
  subtitle,
  image,
  iconName,
  accent,
}: DiscoveryFeatureCardProps) {
  const [imageSrc, setImageSrc] = useState(image)
  const Icon = FEATURE_ICONS[iconName]
  const [imageFailed, setImageFailed] = useState(false)

  function handleImageError() {
    if (imageSrc !== FALLBACK_IMAGE) {
      setImageSrc(FALLBACK_IMAGE)
      return
    }
    setImageFailed(true)
  }

  return (
    <Link
      href={href}
      aria-label={`${title}: ${subtitle}`}
      className="group relative isolate block min-h-44 w-[82vw] max-w-[300px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#121826] shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:min-h-48 sm:w-[270px]"
    >
      {!imageFailed && (
        <Image
          src={imageSrc}
          alt=""
          fill
          loading="lazy"
          sizes="(max-width: 640px) 82vw, 300px"
          onError={handleImageError}
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
        />
      )}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-10 bg-gradient-to-t ${accent} via-[#07110F]/45 to-[#06100E]/95`}
      />
      <div className="absolute inset-x-0 bottom-0 z-20 p-3.5 sm:p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/25 bg-black/20 text-white shadow-sm backdrop-blur-sm">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="mt-2.5 text-sm font-black text-white">{title}</p>
        <p className="mt-0.5 text-[11px] leading-4 text-white/90">{subtitle}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-extrabold text-white">
          Fungua <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        </span>
      </div>
    </Link>
  )
}
