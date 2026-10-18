import Link from 'next/link'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, BadgeCheck, BookOpen, Building2, CircleHelp, GraduationCap, MapPin, MessageCircle, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import JoinInstitutionCommunityButton from '@/components/institutions/JoinInstitutionCommunityButton'
import { CommunityActions, JoinGroupButton } from '@/components/community/CommunityActions'

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string; create?: string }> }
type ScopedGroup = { id: string; name: string; description: string; level: string | null; privacy: string; member_count: number; subject_id: string | null; created_at: string }
type ScopedQuestion = { id: string; title: string | null; body: string; subject_id: string; status: string; upvotes: number; created_at: string }
type Subject = { id: string; name: string; level: string }

export default async function InstitutionPage({ params, searchParams }: Params) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const kind = sp.kind === 'tertiary' ? 'tertiary' : 'school'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')
  const table = kind === 'school' ? 'schools' : 'universities'
  const { data: institution } = await supabase.from(table).select('*').eq('id', id).maybeSingle()
  if (!institution) notFound()

  const [{ data: viewerProfile }, communityResult] = await Promise.all([
    supabase.from('profiles').select('level,school_id,university_id,status').eq('id', user.id).maybeSingle(),
    (async () => { let query = supabase.from('institution_communities').select('id,name,description'); query = kind === 'school' ? query.eq('school_id', id) : query.eq('university_id', id); return query.maybeSingle() })(),
  ])
  const community = communityResult.data
  const hasInstitutionMatch = Boolean(viewerProfile?.status === 'active' && (kind === 'school' ? viewerProfile.school_id === id : viewerProfile.university_id === id))

  let alreadyJoined = false
  if (community) {
    const { data: membership } = await supabase.from('institution_community_members').select('member_role').eq('community_id', community.id).eq('user_id', user.id).maybeSingle()
    alreadyJoined = Boolean(membership)
  }

  let subjects: Subject[] = []
  let groups: ScopedGroup[] = []
  let questions: ScopedQuestion[] = []
  let memberIds = new Set<string>()
  if (hasInstitutionMatch) {
    const [subjectsRes, groupsRes, questionsRes, membershipsRes] = await Promise.all([
      supabase.from('subjects').select('id,name,level').order('name'),
      (async () => { let query = supabase.from('study_groups').select('id,name,description,level,privacy,member_count,subject_id,created_at').eq('status','active').order('created_at',{ascending:false}).limit(50); query = kind === 'school' ? query.eq('school_id',id) : query.eq('university_id',id); return query })(),
      (async () => { let query = supabase.from('questions').select('id,title,body,subject_id,status,upvotes,created_at').in('status',['open','resolved']).order('created_at',{ascending:false}).limit(50); query = kind === 'school' ? query.eq('school_id',id) : query.eq('university_id',id); return query })(),
      supabase.from('group_members').select('group_id').eq('user_id', user.id),
    ])
    subjects = (subjectsRes.data ?? []) as Subject[]
    groups = (groupsRes.data ?? []) as ScopedGroup[]
    questions = (questionsRes.data ?? []) as ScopedQuestion[]
    memberIds = new Set((membershipsRes.data ?? []).map((item) => item.group_id))
  }

  const subjectMap = new Map(subjects.map((item) => [item.id, item.name]))
  const institutionName = String(institution.name || 'Taasisi')
  const location = [institution.region, institution.district, institution.country || 'Tanzania'].filter(Boolean).join(' · ')
  const source = institution.source_name ? String(institution.source_name) : 'Taarifa ya taasisi iliyo kwenye katalogi ya SmartNekam.'
  const tags = kind === 'school' ? [institution.school_type, ...(Array.isArray(institution.education_levels) ? institution.education_levels : [])] : [institution.institution_type, institution.registration_status]
  const scope = { kind, id, name: institutionName } as const

  return <main className="mx-auto max-w-5xl space-y-5">
    <Link href="/communities?tab=official" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-500 transition hover:text-violet-600"><ArrowLeft className="h-4 w-4" />Rudi kwenye Shule na Vyuo Rasmi</Link>
    <section className="relative isolate overflow-hidden rounded-3xl p-6 text-white sm:p-8"><Image src="/images/reference-home-feed.webp" alt="Wanafunzi wakijifunza pamoja" fill priority sizes="(max-width: 768px) 100vw, 1200px" className="absolute inset-0 -z-20 object-cover opacity-70"/><div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#0B0F1A]/95 via-[#17264D]/85 to-[#302259]/70"/><div className="relative z-10 flex items-start gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10"><GraduationCap className="h-7 w-7" /></span><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-200">Official Institution Space</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">{institutionName}</h1><p className="mt-2 flex items-center gap-2 text-sm text-slate-200"><MapPin className="h-4 w-4 shrink-0" />{location || 'Tanzania'}</p></div></div><Building2 className="absolute -bottom-8 -right-3 h-40 w-40 text-white/10" /></section>

    <section className="grid gap-4 md:grid-cols-[1.25fr_0.75fr]">
      <article className="geometric-card p-5 sm:p-6"><div className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-teal-500" /><h2 className="text-lg font-extrabold text-slate-950 dark:text-white">Taarifa za taasisi</h2></div><div className="mt-4 flex flex-wrap gap-2">{tags.filter(Boolean).map((tag) => <span key={String(tag)} className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">{String(tag).replaceAll('_', ' ')}</span>)}</div><p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">Hii ni sehemu ya wanafunzi waliochagua taasisi hii kwenye profile zao. Maswali na study groups zinazotengenezwa hapa huonekana hapa tu kwa wanafunzi wa taasisi hii; hazichanganywi na Q&A ya wazi ya SmartNekam.</p><p className="mt-4 text-xs text-slate-400">Chanzo: {source}{institution.last_verified_at ? ` · Ilikaguliwa ${new Date(String(institution.last_verified_at)).toLocaleDateString('sw-TZ')}` : ''}</p>{institution.source_url && <a href={String(institution.source_url)} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-bold text-indigo-500 hover:underline">Fungua chanzo rasmi ↗</a>}</article>
      <aside className="geometric-card p-5 sm:p-6"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><Users className="h-5 w-5" /></span><h2 className="mt-3 text-lg font-extrabold text-slate-950 dark:text-white">Official Community</h2><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-300">{community?.description || 'Jamii rasmi ya taasisi hii kwa matangazo rasmi na mawasiliano ya wanafunzi.'}</p>{community ? <div className="mt-4"><JoinInstitutionCommunityButton communityId={community.id} alreadyJoined={alreadyJoined} /></div> : <p className="mt-4 text-sm text-amber-600">Community haipo bado. Kagua migrations za registry za taasisi.</p>}</aside>
    </section>

    {!hasInstitutionMatch ? <section className="geometric-card p-5 sm:p-6"><div className="flex items-start gap-3"><ShieldCheckSmall /><div><h2 className="font-extrabold text-slate-950 dark:text-white">Eneo hili ni la wanafunzi wa taasisi hii</h2><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">Profile yako haijaunganishwa na {institutionName}. Maswali na vikundi vya ndani havitaonyeshwa. Hakikisha umechagua taasisi sahihi kwenye profile yako.</p><Link href="/profile" className="mt-3 inline-flex rounded-xl sn-primary-gradient px-4 py-2.5 text-sm font-extrabold text-white">Angalia profile</Link></div></div></section> : <>
      <section className="space-y-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-violet-500">Institution-only</p><h2 className="mt-1 font-heading text-xl font-black text-slate-950 dark:text-white">Maswali na vikundi vya {institutionName}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Unachochapisha hapa kitaonekana kwa wanafunzi wenye shule/chuo hiki kwenye profile zao pekee.</p></div><CommunityActions subjects={subjects} initialCreate={sp.create ?? ''} institutionScope={scope} /></section>
      <section className="space-y-3"><div className="flex items-end justify-between gap-3"><div><h2 className="font-heading text-lg font-extrabold text-slate-950 dark:text-white">Maswali ya taasisi ({questions.length})</h2><p className="text-xs text-slate-500">Q&A ya ndani; haiingii kwenye Q&A ya wanafunzi wote.</p></div><CircleHelp className="h-5 w-5 text-violet-500"/></div><div className="geometric-card divide-y divide-slate-100 dark:divide-slate-800">{questions.map((q) => <article key={q.id} className="p-4"><Link href={`/communities/questions/${q.id}`} className="block"><h3 className="font-extrabold text-slate-950 dark:text-white">{q.title || q.body.slice(0,100)}</h3><p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{q.body}</p><p className="mt-2 text-xs text-slate-500">{subjectMap.get(q.subject_id) || 'Somo'} · {q.upvotes} kura · {new Date(q.created_at).toLocaleDateString('sw-TZ')}</p></Link></article>)}{questions.length === 0 && <div className="p-6 text-center"><MessageCircle className="mx-auto h-7 w-7 text-slate-400"/><p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">Bado hakuna swali la taasisi hii</p><p className="mt-1 text-xs text-slate-500">Tumia “Uliza swali la taasisi” kuanzisha mjadala wa kwanza.</p></div>}</div></section>
      <section className="space-y-3"><div className="flex items-end justify-between gap-3"><div><h2 className="font-heading text-lg font-extrabold text-slate-950 dark:text-white">Study groups ({groups.length})</h2><p className="text-xs text-slate-500">Vikundi vya masomo vya wanafunzi wa taasisi hii.</p></div><BookOpen className="h-5 w-5 text-indigo-500"/></div><div className="grid gap-3 sm:grid-cols-2">{groups.map((g) => <article key={g.id} className="geometric-card flex flex-col p-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><Users className="h-5 w-5"/></span><div className="min-w-0 flex-1"><h3 className="font-extrabold text-slate-950 dark:text-white">{g.name}</h3><p className="mt-1 text-xs text-slate-500">{g.level || 'Viwango vyote'}{g.subject_id ? ` · ${subjectMap.get(g.subject_id) || 'Somo'}` : ''}</p></div></div><p className="mt-3 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{g.description || 'Kikundi cha kujifunza pamoja.'}</p><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800"><span className="text-xs text-slate-500">{g.member_count} members</span>{memberIds.has(g.id) ? <Link href={`/communities/room/${g.id}`} className="rounded-xl border border-indigo-200 px-3 py-2 text-xs font-extrabold text-indigo-700 dark:border-indigo-900 dark:text-indigo-200">Fungua</Link> : <JoinGroupButton groupId={g.id} inviteRequired={g.privacy === 'private'} />}</div></article>)}{groups.length === 0 && <div className="geometric-card p-6 text-center sm:col-span-2"><Users className="mx-auto h-7 w-7 text-slate-400"/><p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">Hakuna group bado</p><p className="mt-1 text-xs text-slate-500">Tengeneza group ili wanafunzi wa taasisi hii waanze kujifunza pamoja.</p></div>}</div></section>
    </>}
    <Link href="/communities?tab=qa" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-500 hover:underline"><MessageCircle className="h-4 w-4"/>Nenda kwenye Q&A ya wazi ya SmartNekam (wote)</Link>
  </main>
}

function ShieldCheckSmall() { return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200"><BadgeCheck className="h-5 w-5"/></span> }
