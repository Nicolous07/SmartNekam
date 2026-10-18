'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function JoinInstitutionCommunityButton({ communityId, alreadyJoined = false }: { communityId: string; alreadyJoined?: boolean }) {
  const router = useRouter()
  const [joined, setJoined] = useState(alreadyJoined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [role, setRole] = useState('')

  async function join() {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error: joinError } = await supabase.rpc('join_smartnekam_institution_community', { p_community_id: communityId })
    setLoading(false)
    if (joinError) {
      setError(joinError.message || 'Imeshindikana kujiunga na jamii hii.')
      return
    }
    const result = Array.isArray(data) ? data[0] : data
    setRole(result?.result_member_role === 'member' ? 'Mwanafunzi wa taasisi' : 'Visitor')
    setJoined(true)
    router.refresh()
  }

  if (joined) return <div className="space-y-1"><span className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-3 text-sm font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><Check className="h-4 w-4" />Umejiunga na Official Community</span>{role && <p className="text-xs text-slate-500">Aina ya uanachama: {role}</p>}</div>
  return <div className="space-y-2"><button type="button" onClick={join} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-violet-700 disabled:opacity-60">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}{loading ? 'Inaunganisha...' : 'Jiunge na jamii rasmi'}</button>{error && <p role="alert" className="max-w-xl text-sm text-red-500">{error}</p>}</div>
}
