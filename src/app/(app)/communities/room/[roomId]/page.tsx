import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, LockKeyhole, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { JoinGroupButton } from '@/components/community/CommunityActions'
import { GroupPosts, StudyGroupChat } from '@/components/communities/StudyGroupChat'

export default async function StudyGroupPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: group } = await supabase.from('study_groups').select('id,name,description,level,privacy,member_count,creator_id,invite_code,created_at').eq('id', roomId).eq('status', 'active').maybeSingle()
  if (!group) notFound()

  const [{ data: membership }, { data: posts }] = await Promise.all([
    supabase.from('group_members').select('group_id,role').eq('group_id', roomId).eq('user_id', user.id).maybeSingle(),
    supabase.from('group_posts').select('id,author_id,body,created_at').eq('group_id', roomId).order('created_at', { ascending: false }).limit(30),
  ])
  const isMember = Boolean(membership)
  if (group.privacy === 'private' && !isMember && group.creator_id !== user.id) notFound()

  return <main className="mx-auto max-w-6xl space-y-5 pb-8">
    <Link href="/communities?tab=groups" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300"><ArrowLeft className="h-4 w-4"/> Rudi kwenye Study Groups</Link>
    <header className="geometric-hero relative overflow-hidden rounded-3xl p-5 text-white sm:p-7"><div className="relative z-10"><p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-emerald-100">Study Group {group.privacy === 'private' ? '· Private' : '· Public'}</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">{group.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">{group.description || 'Kikundi cha kujifunza na kusaidiana.'}</p><div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-emerald-50"><span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4"/>{group.member_count} wanachama</span>{group.level && <span>{group.level.replace('_','-')}</span>}{group.privacy === 'private' && <span className="inline-flex items-center gap-1"><LockKeyhole className="h-3.5 w-3.5"/>Invite only</span>}</div></div></header>
    {!isMember && group.creator_id !== user.id && <section className="geometric-card flex flex-wrap items-center justify-between gap-3 p-4"><div><h2 className="font-extrabold text-slate-900 dark:text-white">Jiunge na kikundi</h2><p className="mt-1 text-sm text-slate-500">Ukiwa mwanachama utaweza kutuma post na kuandika kwenye chat.</p></div><JoinGroupButton groupId={group.id} inviteRequired={group.privacy === 'private'}/></section>}
    <div className="space-y-4">
      <StudyGroupChat groupId={group.id} userId={user.id} isMember={isMember || group.creator_id === user.id} groupName={group.name} memberCount={group.member_count}/>
      {isMember || group.creator_id === user.id ? <GroupPosts groupId={group.id} initialPosts={(posts ?? []) as {id:string;author_id:string;body:string;created_at:string}[]} /> : <section className="geometric-card p-5"><h2 className="font-heading font-extrabold text-slate-900 dark:text-white">Posts za kikundi</h2><div className="mt-3 space-y-3">{(posts ?? []).length ? (posts ?? []).map((p) => <article key={p.id} className="rounded-xl border border-emerald-100 p-3 dark:border-slate-800"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{p.body}</p><p className="mt-2 text-[11px] text-slate-400">{new Date(p.created_at).toLocaleDateString('sw-TZ')}</p></article>) : <p className="text-sm text-slate-500">Bado hakuna post kwenye kikundi hiki.</p>}</div></section>}
    </div>
  </main>
}
