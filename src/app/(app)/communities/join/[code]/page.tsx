import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Link2, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function JoinByCodePage({params}:{params:Promise<{code:string}>}) {
  const {code}=await params
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user) redirect('/auth')
  const {data,error}=await supabase.rpc('join_smartnekam_study_group_by_code',{p_invite_code:decodeURIComponent(code).slice(0,32)})
  if(!error&&data) redirect(`/communities/room/${data}`)
  return <main className="geometric-card mx-auto mt-10 max-w-md p-6 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100"><Link2 className="h-6 w-6"/></span><h1 className="mt-3 text-lg font-extrabold text-slate-900 dark:text-white">Kiungo cha mwaliko hakijakubaliwa</h1><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{error?.message ?? 'Kiungo hiki hakionekani kuwa halali.'} Hakikisha umeendesha migration SQL 015, au muombe aliyeleta link akutumie invite code mpya.</p><Link href="/communities?tab=groups" className="mt-4 inline-flex rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white">Angalia study groups</Link></main>
}
