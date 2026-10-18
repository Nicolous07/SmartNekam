'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Link2, Loader2, LogIn, LogOut, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function RoomActions({
  roomId,
  kind,
  isMember,
  inviteCode,
  isCreator,
}: {
  roomId: string
  kind: string
  isMember: boolean
  inviteCode: string
  isCreator: boolean
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  // Lounge haina kujiunga: wanachama ni wa taasisi yenyewe
  const joinable = kind === 'channel' || kind === 'group'

  async function join() {
    setBusy(true)
    setError('')
    const { error: insErr } = await supabase.from('room_members').insert({ room_id: roomId })
    setBusy(false)
    if (insErr) {
      setError(
        insErr.message.includes('row-level security')
          ? 'Chumba hiki ni cha wanachama wa taasisi husika pekee.'
          : 'Imeshindikana kujiunga.'
      )
      return
    }
    router.refresh()
  }

  async function leave() {
    setBusy(true)
    const { data: auth } = await supabase.auth.getUser()
    if (auth.user) {
      await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', auth.user.id)
    }
    setBusy(false)
    router.refresh()
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/communities/join/${inviteCode}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard haipatikani
    }
  }

  async function deleteGroup() {
    if (!window.confirm('Futa kikundi hiki na ujumbe wake wote? Hili haliwezi kurudishwa.')) return
    setBusy(true)
    const { error: delErr } = await supabase.from('chat_rooms').delete().eq('id', roomId)
    setBusy(false)
    if (!delErr) {
      router.push('/communities?tab=groups')
      router.refresh()
    }
  }

  const btn =
    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-95 disabled:opacity-50'

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {joinable && !isMember && (
        <button
          type="button"
          onClick={join}
          disabled={busy}
          className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500`}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
          Jiunge
        </button>
      )}
      {kind === 'group' && isMember && (
        <button
          type="button"
          onClick={copyInvite}
          className={`${btn} border border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950`}
        >
          {copied ? <Check className="anim-pop h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
          {copied ? 'Imenakiliwa' : 'Kiungo cha mwaliko'}
        </button>
      )}
      {joinable && isMember && !isCreator && (
        <button
          type="button"
          onClick={leave}
          disabled={busy}
          className={`${btn} text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800`}
        >
          <LogOut className="h-3.5 w-3.5" /> Toka
        </button>
      )}
      {kind === 'group' && isCreator && (
        <button
          type="button"
          onClick={deleteGroup}
          disabled={busy}
          className={`${btn} text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40`}
        >
          <Trash2 className="h-3.5 w-3.5" /> Futa
        </button>
      )}
      {error && <p className="w-full text-right text-xs text-red-600">{error}</p>}
    </div>
  )
}
