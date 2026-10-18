'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Trophy, UserCog, MapPin, Crown } from 'lucide-react'
import { getLevel } from '@/lib/levels'

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'U'
  )
}

export default function ProfileRankCard({
  name,
  username,
  avatarUrl,
  roleLabel,
  countryCode,
  points,
}: {
  name: string
  username: string | null
  avatarUrl: string | null
  roleLabel: string
  countryCode: string | null
  points: number
}) {
  const level = getLevel(points)
  const [mounted, setMounted] = useState(false)

  // Bar ya maendeleo inajaa taratibu ukurasa unapofunguka
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 150)
    return () => clearTimeout(t)
  }, [])

  return (
    <section className="geometric-card overflow-hidden">
      <div className="flex items-center justify-between bg-gradient-to-r from-emerald-700 to-teal-600 px-4 py-3 text-white">
        <h2 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide">
          <Trophy className="h-4 w-4 text-amber-300" /> Your Profile &amp; Rank
        </h2>
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold">
          {roleLabel}
        </span>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-600 text-lg font-extrabold text-white ring-4 ring-emerald-100 dark:ring-emerald-900/50">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(name)
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-900 dark:text-white">{name}</p>
            {username && (
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">@{username}</p>
            )}
            {countryCode && (
              <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <MapPin className="h-3 w-3" /> {countryCode}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Kiwango cha {level.number}
              </p>
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                <Crown className="h-4 w-4 text-amber-500" /> {level.current.name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">
                {points.toLocaleString('en-US')}
              </p>
              <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                EduPoints
              </p>
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000 ease-out"
              style={{ width: mounted ? `${Math.round(level.progress * 100)}%` : '0%' }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] font-medium text-slate-500 dark:text-slate-400">
            <span>Maendeleo: {Math.round(level.progress * 100)}%</span>
            <span>
              {level.next
                ? `Bado pointi ${(level.next.min - points).toLocaleString('en-US')} kufika ${level.next.name}`
                : 'Ngazi ya juu kabisa'}
            </span>
          </div>
        </div>

        <Link
          href="/profile"
          className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 active:scale-[0.98] dark:text-emerald-300 dark:hover:bg-emerald-950/50"
        >
          <UserCog className="h-4 w-4" /> Profile, Wallet na Settings
        </Link>
      </div>
    </section>
  )
}
