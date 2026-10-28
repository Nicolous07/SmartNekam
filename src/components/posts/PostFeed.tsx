import Link from 'next/link'
import DiscoveryFeatureCard from './DiscoveryFeatureCard'
import { ArrowLeft, ArrowRight, GraduationCap, MapPin, MessageCircle, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import PostCard, { type FeedPost } from './PostCard'
import OpenPostComposerButton from './OpenPostComposerButton'

type SuggestedUser = { user_id: string; full_name: string; username: string; avatar_url: string | null; role: string; can_message: boolean }
type Institution = { id: string; name: string; region?: string | null; country?: string | null }
type StudyGroup = { id: string; name: string; description: string; level: string | null; member_count: number; subject_id: string | null }
const DISCOVERY_MODES = ['features', 'people', 'institutions'] as const
type DiscoveryMode = typeof DISCOVERY_MODES[number]

function initials(name: string) { return name.trim().split(/\s+/).slice(0,2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U' }
function DirectionDivider({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="my-1 rounded-2xl border border-indigo-200/70 bg-gradient-to-r from-indigo-50 via-white to-violet-50 px-3 py-4 dark:border-white/10 dark:from-[#111a2d] dark:via-[#151b2b] dark:to-[#211b3a] sm:px-5"><div className="flex items-center gap-3"><div className="h-px flex-1 bg-gradient-to-r from-transparent via-indigo-400/70 to-violet-500"/><ArrowLeft className="h-4 w-4 shrink-0 rotate-180 text-violet-500"/><span className="text-[10px] font-black uppercase tracking-[.17em] text-indigo-600 dark:text-indigo-300">{eyebrow}</span><ArrowRight className="h-4 w-4 shrink-0 text-violet-500"/><div className="h-px flex-1 bg-gradient-to-r from-violet-500 via-indigo-400/70 to-transparent"/></div><h3 className="mt-2 text-center font-heading text-lg font-black text-slate-950 dark:text-white sm:text-xl">{title}</h3><p className="mt-1 text-center text-xs leading-5 text-slate-500 dark:text-slate-400">{subtitle}</p></div>
}

function FeatureDiscovery() {
  const features = [
    { href: '/library', title: 'Library', subtitle: 'Notes, vitabu na mitihani', image: '/images/reference-library.webp', iconName: 'library', accent: 'from-indigo-700/90' },
    { href: '/learn', title: 'Learn', subtitle: 'Kozi, AI na quizzes', image: '/images/reference-learn.webp', iconName: 'book', accent: 'from-violet-700/90' },
    { href: '/communities', title: 'Jamii', subtitle: 'Q&A na study groups', image: '/images/reference-home-feed.webp', iconName: 'users', accent: 'from-blue-700/90' },
    { href: '/opportunities', title: 'Fursa', subtitle: 'Scholarships na internships', image: '/images/reference-opportunities.webp', iconName: 'briefcase', accent: 'from-indigo-700/90' },
  ] as const
  return (
    <section className="min-w-0 max-w-full space-y-3" aria-label="Gundua SmartNekam">
      <DirectionDivider eyebrow="Gundua SmartNekam" title="Sehemu za kuendelea na safari yako" subtitle="Kutoka kwenye post, fungua huduma unayohitaji—kisha rudi kwenye feed." />
      <div className="mb-1 flex items-center justify-between gap-2 px-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        <span>Telezesha kushoto au kulia kuona huduma zote</span>
        <span aria-hidden="true" className="shrink-0 text-emerald-600 dark:text-emerald-400">← →</span>
      </div>
      <div className="sn-horizontal-rail -mx-1 flex w-full min-w-0 max-w-full snap-x snap-mandatory flex-nowrap gap-3 overflow-x-auto overscroll-x-contain px-1 pb-3 touch-pan-x" role="region" aria-label="Huduma za SmartNekam zinazoteleza kwa mlalo" tabIndex={0}>
        {features.map((feature) => <DiscoveryFeatureCard key={feature.href} {...feature} />)}
      </div>
    </section>
  )
}

function PeopleDiscovery({ people }: { people: SuggestedUser[] }) {
  return <section className="space-y-3"><DirectionDivider eyebrow="SmartNekam People" title="Wanafunzi wa kuungana nao" subtitle="Uliza swali, fungua mjadala au shiriki kitu unachojua. Profile za private hazionyeshwi hapa."/><div className="sn-horizontal-rail flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-3 -mx-1 touch-pan-x">{people.map((person) => <article key={person.user_id} className="geometric-card flex min-w-[82%] max-w-[340px] shrink-0 snap-start items-center gap-3 p-3 sm:min-w-[300px]"><span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-black text-white ring-2 ring-indigo-200 dark:ring-indigo-950">{person.avatar_url ? <img src={person.avatar_url} alt="" className="h-full w-full object-cover"/> : initials(person.full_name || person.username)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-slate-950 dark:text-white">{person.full_name || person.username}</p><p className="truncate text-xs text-slate-500 dark:text-slate-400">@{person.username} · {person.role === 'mentor' ? 'Mentor' : person.role === 'teacher' ? 'Mwalimu' : 'Mwanafunzi'}</p><div className="mt-2 flex flex-wrap gap-1.5"><Link href="/communities?tab=qa&create=question" className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-2 py-1 text-[10px] font-extrabold text-indigo-700 dark:border-indigo-900 dark:text-indigo-200"><MessageCircle className="h-3 w-3"/>Uliza swali</Link>{person.can_message && <Link href="/communities?tab=chats" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-extrabold text-slate-600 dark:border-slate-700 dark:text-slate-300">Chat</Link>}</div></div></article>)}{people.length === 0 && <div className="geometric-card p-4 sm:col-span-2"><p className="text-sm text-slate-600 dark:text-slate-300">Bado hakuna profile za kupendekeza kulingana na mipangilio ya faragha.</p></div>}</div><div className="flex justify-end"><OpenPostComposerButton label="Shiriki jambo kwenye Home Feed"/></div></section>
}

function InstitutionAndGroupsDiscovery({ schools, universities, groups }: { schools: Institution[]; universities: Institution[]; groups: StudyGroup[] }) {
  return <section className="space-y-3"><DirectionDivider eyebrow="Campus & Study groups" title="Gundua shule na vikundi" subtitle="Pata eneo lako la taasisi au jiunge na group ya masomo. Vikundi vya taasisi vinaonekana kwa wanafunzi wa shule/chuo husika tu."/><div className="sn-horizontal-rail flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-3 -mx-1 touch-pan-x"><div className="geometric-card min-w-[84%] max-w-[430px] shrink-0 snap-start p-3 sm:p-4"><div className="mb-3 flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"><GraduationCap className="h-4 w-4"/></span><div><h3 className="font-extrabold text-slate-950 dark:text-white">Shule na vyuo</h3><p className="text-[10px] text-slate-500">Official institution spaces</p></div></div><div className="space-y-2">{schools.map((school) => <Link key={school.id} href={`/communities/institution/${school.id}?kind=school`} className="flex items-center gap-2 rounded-xl border border-slate-100 p-2.5 transition hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-slate-800 dark:hover:bg-slate-900"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"><GraduationCap className="h-4 w-4"/></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-extrabold text-slate-900 dark:text-white">{school.name}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500"><MapPin className="mr-1 inline h-3 w-3"/>{school.region || school.country || 'Taasisi'}</span></span><ArrowRight className="h-3.5 w-3.5 shrink-0 text-indigo-500"/></Link>)}{universities.map((uni) => <Link key={uni.id} href={`/communities/institution/${uni.id}?kind=tertiary`} className="flex items-center gap-2 rounded-xl border border-slate-100 p-2.5 transition hover:border-violet-300 hover:bg-violet-50/50 dark:border-slate-800 dark:hover:bg-slate-900"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200"><GraduationCap className="h-4 w-4"/></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-extrabold text-slate-900 dark:text-white">{uni.name}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{uni.region || uni.country || 'Chuo kikuu'}</span></span><ArrowRight className="h-3.5 w-3.5 shrink-0 text-violet-500"/></Link>)}{schools.length + universities.length === 0 && <p className="text-xs text-slate-500">Taasisi zitaonekana hapa zikishapatikana kwenye registry.</p>}</div><Link href="/communities?tab=official" className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-indigo-600 dark:text-indigo-300">Angalia taasisi zote <ArrowRight className="h-3 w-3"/></Link></div>
      <div className="geometric-card min-w-[84%] max-w-[430px] shrink-0 snap-start p-3 sm:p-4"><div className="mb-3 flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><Users className="h-4 w-4"/></span><div><h3 className="font-extrabold text-slate-950 dark:text-white">Study groups</h3><p className="text-[10px] text-slate-500">Vikundi vya umma</p></div></div><div className="space-y-2">{groups.map((group) => <Link key={group.id} href="/communities?tab=groups" className="block rounded-xl border border-slate-100 p-3 transition hover:border-violet-300 hover:bg-violet-50/50 dark:border-slate-800 dark:hover:bg-slate-900"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200"><Users className="h-4 w-4"/></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-extrabold text-slate-900 dark:text-white">{group.name}</span><span className="text-[10px] text-slate-500">{group.member_count} members · {group.level || 'Viwango vyote'}</span></span><ArrowRight className="h-3.5 w-3.5 text-violet-500"/></div>{group.description && <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{group.description}</p>}</Link>)}{groups.length === 0 && <p className="text-xs text-slate-500">Groups za umma zitaonekana hapa zikishaundwa.</p>}</div><Link href="/communities?tab=groups" className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-violet-600 dark:text-violet-300">Tafuta vikundi vyote <ArrowRight className="h-3 w-3"/></Link></div></div></section>
}

export default async function PostFeed() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: appPreferences } = user
    ? await supabase.from('user_app_preferences').select('low_data_mode').eq('user_id', user.id).maybeSingle()
    : { data: null }
  const lowDataMode = Boolean(appPreferences?.low_data_mode)

  const [feedResult, peopleResult, schoolsResult, universitiesResult, groupsResult, promotionsResult] = await Promise.all([
    supabase.from('posts_feed').select('id, author_id, category, subject, content, image_url, created_at, author_name, author_username, author_avatar, author_role, like_count, comment_count, share_count, liked_by_me, is_anonymous, attachments, author_follower_count, following_author_by_me').order('created_at', { ascending: false }).limit(lowDataMode ? 8 : 20),
    user ? supabase.rpc('get_suggested_smartnekam_users', { p_limit: lowDataMode ? 3 : 6 }) : Promise.resolve({ data: [], error: null }),
    supabase.from('schools').select('id,name,region,country').order('name').limit(lowDataMode ? 1 : 3),
    supabase.from('universities').select('id,name,region,country').order('name').limit(lowDataMode ? 1 : 2),
    supabase.from('study_groups').select('id,name,description,level,member_count,subject_id').eq('status','active').eq('privacy','public').is('school_id',null).is('university_id',null).order('member_count',{ascending:false}).limit(lowDataMode ? 2 : 3),
    supabase.rpc('get_active_smartnekam_promotions'),
  ])
  const basePosts = (feedResult.data ?? []) as FeedPost[]
  const promotionRows = (promotionsResult.data ?? []) as { post_id: string; is_pinned: boolean; is_sponsored: boolean; promotion_label: string | null; promoted_until: string | null }[]
  let pinnedPosts: FeedPost[] = []
  if (promotionRows.length) {
    const { data: pinnedData } = await supabase.from('posts_feed')
      .select('id, author_id, category, subject, content, image_url, created_at, author_name, author_username, author_avatar, author_role, like_count, comment_count, share_count, liked_by_me, is_anonymous, attachments, author_follower_count, following_author_by_me')
      .in('id', promotionRows.map((row) => row.post_id))
    pinnedPosts = (pinnedData ?? []) as FeedPost[]
  }
  const promotionById = new Map(promotionRows.map((row) => [row.post_id, row]))
  const allPostsById = new Map<string, FeedPost>()
  for (const post of [...basePosts, ...pinnedPosts]) {
    const promo = promotionById.get(post.id)
    allPostsById.set(post.id, promo ? { ...post, is_pinned: promo.is_pinned, is_sponsored: promo.is_sponsored, promotion_label: promo.promotion_label, promoted_until: promo.promoted_until } : post)
  }
  const posts = [...allPostsById.values()].sort((a, b) => {
    const pinnedDifference = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned))
    if (pinnedDifference) return pinnedDifference
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
  const people = (peopleResult.data ?? []) as SuggestedUser[]
  const schools = (schoolsResult.data ?? []) as Institution[]
  const universities = (universitiesResult.data ?? []) as Institution[]
  const groups = (groupsResult.data ?? []) as StudyGroup[]
  const feedError = feedResult.error
  const renderedModes = new Set<DiscoveryMode>()
  const batches: { posts: FeedPost[]; mode: DiscoveryMode }[] = []
  for (let i = 0; i < posts.length; i += 3) {
    const mode = DISCOVERY_MODES[batches.length % DISCOVERY_MODES.length]
    renderedModes.add(mode)
    batches.push({ posts: posts.slice(i, i + 3), mode })
  }
  const missingModes = DISCOVERY_MODES.filter((mode) => !renderedModes.has(mode))

  const renderDiscovery = (mode: DiscoveryMode, index: string) => mode === 'features'
    ? <FeatureDiscovery key={index} />
    : mode === 'people'
      ? <PeopleDiscovery key={index} people={people} />
      : <InstitutionAndGroupsDiscovery key={index} schools={schools} universities={universities} groups={groups} />

  return <section className="space-y-4">
    <div className="flex items-center justify-between gap-3"><h2 className="font-heading text-lg font-bold text-slate-900 dark:text-white">Mijadala ya hivi karibuni</h2><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-extrabold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">Feed ya SmartNekam</span></div>
    {feedError && <p className="geometric-card p-4 text-sm text-red-600">Imeshindikana kupakia posts: {feedError.message}. Hakikisha umeendesha SQL 016, SQL 018 na SQL 021 (Feed, Attachments na Follow).</p>}
    {posts.length === 0 && !feedError && <p className="geometric-card p-5 text-sm text-slate-500 dark:text-slate-400">Bado hakuna posts. Bonyeza kitufe cha (+) kuanza mjadala wa kwanza.</p>}
    {batches.map((batch, batchIndex) => <div key={`batch-${batchIndex}`} className="space-y-4">{batch.posts.map((post, i) => <PostCard key={post.id} post={post} index={batchIndex * 3 + i} viewerId={user?.id ?? null} />)}{renderDiscovery(batch.mode, `discovery-${batchIndex}`)}</div>)}
    {missingModes.map((mode, i) => renderDiscovery(mode, `discovery-extra-${i}`))}
    <div className="flex justify-center pt-1"><OpenPostComposerButton label="Shiriki post yako"/></div>
  </section>
}
