'use client'

import { useMemo, useState } from 'react'
import { Bookmark } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SaveButton({
  oppId,
  saved: initial,
  withLabel = false,
}: {
  oppId: string | number
  saved: boolean
  withLabel?: boolean
}) {
  const supabase = useMemo(() => createClient(), [])
  const [saved, setSaved] = useState(initial)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (busy) return
    setBusy(true)
    const next = !saved
    setSaved(next) // badilisha mara moja, rudisha ikishindikana
    const {
      data: { user },
    } = await supabase.auth.getUser()
    let failed = !user
    if (user) {
      const res = next
        ? await supabase.from('opp_saved').insert({ opportunity_id: oppId })
        : await supabase.from('opp_saved').delete().eq('opportunity_id', oppId).eq('user_id', user.id)
      failed = Boolean(res.error && res.error.code !== '23505')
    }
    if (failed) setSaved(!next)
    setBusy(false)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? 'Ondoa kwenye zilizohifadhiwa' : 'Hifadhi kwa baadaye'}
      className={`flex items-center gap-1.5 rounded-full p-2 text-sm font-semibold transition active:scale-90 ${
        saved
          ? 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300'
          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800'
      }`}
    >
      <Bookmark className={`h-5 w-5 ${saved ? 'fill-current' : ''}`} />
      {withLabel && <span>{saved ? 'Imehifadhiwa' : 'Hifadhi'}</span>}
    </button>
  )
}
