'use client'

import { useEffect, useState } from 'react'
import { Wallet, Crown, Gift, Copy, Check, CreditCard } from 'lucide-react'
import { getLevel } from '@/lib/levels'

export default function WalletCard({
  points,
  username,
}: {
  points: number
  username: string | null
}) {
  const level = getLevel(points)
  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 200)
    return () => clearTimeout(t)
  }, [])

  async function copyReferral() {
    if (!username) return
    try {
      await navigator.clipboard.writeText(username)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard haipatikani
    }
  }

  return (
    <section id="wallet" className="geometric-card scroll-mt-20 overflow-hidden">
      <div className="anim-gradient bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-700 p-5 text-white">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-100">
          <Wallet className="h-4 w-4" /> Wallet yako
        </p>
        <p className="mt-2 text-4xl font-extrabold">
          {points.toLocaleString('en-US')}
          <span className="ml-2 text-base font-semibold text-emerald-100">EduPoints</span>
        </p>
      </div>

      <div className="space-y-4 p-5">
        {/* Kiwango */}
        <div>
          <div className="flex items-center justify-between text-sm">
            <p className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
              <Crown className="h-4 w-4 text-amber-500" />
              Kiwango cha {level.number}: {level.current.name}
            </p>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {Math.round(level.progress * 100)}%
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000 ease-out"
              style={{ width: mounted ? `${Math.round(level.progress * 100)}%` : '0%' }}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {level.next
              ? `Bado pointi ${(level.next.min - points).toLocaleString('en-US')} kufika ${level.next.name}`
              : 'Umefika ngazi ya juu kabisa'}
          </p>
        </div>

        {/* Referral */}
        {username && (
          <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-950/30">
            <p className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
              <Gift className="h-4 w-4" /> Alika rafiki, pata bonasi
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Rafiki yako akiweka username yako wakati wa kujisajili, bonasi ya referral inatolewa.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                {username}
              </code>
              <button
                type="button"
                onClick={copyReferral}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-amber-400 active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="anim-pop h-4 w-4" /> Imenakiliwa
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Nakili
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Kununua pointi */}
        <button
          type="button"
          disabled
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-400 dark:border-slate-700"
        >
          <CreditCard className="h-4 w-4" /> Nunua EduPoints (M-Pesa, Tigo Pesa) · Inakuja hivi karibuni
        </button>
      </div>
    </section>
  )
}
