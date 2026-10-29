import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight, Award, Bell, BookOpen, Briefcase, CalendarDays, CheckCircle2,
  Flame, GraduationCap, Library, MessageCircleQuestion, Sparkles, Trophy, Users,
} from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PostFeed from '@/components/posts/PostFeed'
import PostComposerPrompt from '@/components/posts/PostComposerPrompt'
import { isStaffUser } from '@/lib/admin'

function tanzaniaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dar_es_Salaam', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = (key: string) => parts.find((p) => p.type === key)?.value ?? '00'
  return `${part('year')}-${part('month')}-${part('day')}`
}
function prettyDate(value: string | null) {
  if (!value) return 'Tarehe haijawekwa'
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Dar_es_Salaam' })
}
function levelLabel(level: string | null) {
  if (level === 'O_LEVEL') return 'O-Level'
  if (level === 'A_LEVEL') return 'A-Level'
  if (level === 'UNIVERSITY') return 'University'
  return 'Safari yako ya elimu'
}

const shortcuts = [
  { href: '/library', icon: Library, title: 'Maktaba ya Masomo', text: 'Notes, vitabu na past papers', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  { href: '/communities?tab=groups', icon: Users, title: 'Study Groups', text: 'Jiunge na wenzako', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
  { href: '/learn', icon: GraduationCap, title: 'Jifunze', text: 'Kozi, quizzes na flashcards', tone: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
  { href: '/opportunities', icon: Briefcase, title: 'Fursa', text: 'Scholarships na internships', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
]

type SimpleRow = { id: string; title: string; description?: string | null; body?: string | null; level?: string | null; created_at: string; deadline?: string | null; sponsor?: string | null; type?: string | null; verified?: boolean | null; upvotes?: number | null; subject_id?: string | null; exam_type?: string | null; year?: number | null }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')
  const today = tanzaniaDate()
  const [profileRes, notesRes, papersRes, questionsRes, opportunitiesRes, coursesRes, challengeRes, attemptRes, unreadRes, leaderboardRes, appPreferencesRes] = await Promise.all([
    supabase.from('profiles').select('full_name, username, avatar_url, level, xp, coins, streak, longest_streak, role').eq('id', user.id).maybeSingle(),
    supabase.from('notes').select('id,title,description,level,created_at,subject_id').eq('status', 'approved').order('created_at', { ascending: false }).limit(4),
    supabase.from('past_papers').select('id,title,level,year,exam_type,created_at,subject_id').eq('status', 'approved').order('created_at', { ascending: false }).limit(3),
    supabase.from('questions').select('id,title,body,created_at,upvotes,subject_id,status').in('status', ['open', 'resolved']).is('school_id', null).is('university_id', null).order('created_at', { ascending: false }).limit(5),
    supabase.from('opportunities').select('id,title,sponsor,type,deadline,verified,created_at,description').eq('status', 'active').order('deadline', { ascending: true, nullsFirst: false }).limit(4),
    supabase.from('courses').select('id,title,description,level,access_type,estimated_minutes,created_at').eq('status', 'published').order('created_at', { ascending: false }).limit(3),
    supabase.from('daily_challenges').select('challenge_date,quiz_id').eq('challenge_date', today).maybeSingle(),
    supabase.from('quiz_attempts').select('id,status,score,total_marks,xp_awarded').eq('user_id', user.id).eq('challenge_date', today).maybeSingle(),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
    supabase.rpc('get_smartnekam_leaderboard', { p_period: 'week', p_limit: 5 }),
    supabase.from('user_app_preferences').select('low_data_mode').eq('user_id', user.id).maybeSingle(),
  ])

  const profile = profileRes.data
  const lowDataMode = appPreferencesRes.data ? Boolean(appPreferencesRes.data.low_data_mode) : true
  if (!profile) redirect('/onboarding')
  const notes = (notesRes.data ?? []) as SimpleRow[]
  const papers = (papersRes.data ?? []) as SimpleRow[]
  const questions = (questionsRes.data ?? []) as SimpleRow[]
  const opportunities = (opportunitiesRes.data ?? []) as SimpleRow[]
  const courses = coursesRes.data ?? []
  const challenge = challengeRes.data
  const attempt = attemptRes.data
  const leaders = (leaderboardRes.data ?? []) as { rank_position: number; user_id: string; display_name: string; total_xp: number; current_streak: number }[]
  const leaderboardError = leaderboardRes.error?.message ?? null

  return (
    <div className="stagger grid gap-5 xl:h-[calc(100dvh-4.5rem)] xl:grid-cols-[minmax(0,1fr)_320px] xl:overflow-hidden">
      <div className="min-w-0 space-y-5 xl:h-full xl:overflow-y-auto xl:overscroll-contain xl:pr-2 no-scrollbar">
        <section className="geometric-hero glow-green relative isolate overflow-hidden rounded-3xl px-5 py-6 text-white sm:px-8 sm:py-8" data-low-data-mode={lowDataMode}>
          {<Image src="/images/reference-home-feed.webp" alt="Wanafunzi wakijifunza pamoja kwenye maabara ya kompyuta" fill sizes="(max-width: 768px) 100vw, 70vw" className="absolute inset-0 -z-20 object-cover object-center opacity-60" />}
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#0B0F1A]/90 via-[#17264D]/75 to-[#302259]/70" />
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">SmartNekam · Soma. Ungana. Pata Fursa.</p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">Habari, {profile.full_name?.split(' ')[0] ?? 'Mwanafunzi'} 👋</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-50">Karibu kwenye kituo chako cha masomo. Endelea kujifunza, uliza swali, au tafuta fursa inayokufaa.</p>
            <div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full border border-white/20 bg-black/15 px-3 py-1.5 text-xs font-bold">{levelLabel(profile.level)}</span><span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold"><Flame className="h-4 w-4 text-amber-200" />{profile.streak} siku mfululizo</span><span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold"><Sparkles className="h-4 w-4 text-amber-200" />{profile.xp} XP</span></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2"><Link href="/learn/daily-challenge" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-emerald-800 shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-50">Daily Challenge <ArrowRight className="h-4 w-4" /></Link><Link href="/library/upload" className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20">Pakia nyenzo <BookOpen className="h-4 w-4" /></Link></div>
        </section>

        <section id="home-feed" className="space-y-3">
          <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">SmartNekam Community</p><h2 className="mt-1 font-heading text-xl font-extrabold text-slate-950 dark:text-white sm:text-2xl">Home Feed</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Shiriki post, like, jibu comments na endeleza threads za mjadala.</p></div><Link href="/communities?tab=chats" aria-label="Chat na wanafunzi" title="Chat na wanafunzi" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-300/80 bg-white/90 px-2.5 py-2 text-[11px] font-extrabold text-indigo-700 shadow-sm transition hover:bg-violet-50 sm:px-3 sm:text-xs dark:border-violet-400/30 dark:bg-[#182238] dark:text-violet-200 dark:hover:bg-[#202d48]"><Users className="h-4 w-4" /><span className="sm:hidden">Chat</span><span className="hidden sm:inline">Chat na wanafunzi</span></Link></div>
          <PostComposerPrompt displayName={profile.full_name ?? 'Mwanafunzi'} />
          <PostFeed />
        </section>

        <section className="geometric-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-emerald-100 px-4 py-3 dark:border-slate-800"><div><h2 className="font-heading text-lg font-extrabold text-slate-950 dark:text-white">Daily Challenge</h2><p className="text-xs text-slate-500 dark:text-slate-400">Maswali ya leo ya kukupa mazoea ya kujifunza</p></div><Flame className="h-5 w-5 text-orange-500" /></div>
          {attempt?.status === 'submitted' ? <div className="flex items-center gap-3 p-4"><CheckCircle2 className="h-8 w-8 text-emerald-600" /><div className="flex-1"><p className="font-bold text-slate-950 dark:text-white">Changamoto imekamilika!</p><p className="text-sm text-slate-500">Alama: {attempt.score}/{attempt.total_marks} · +{attempt.xp_awarded} XP</p></div><Link href="/learn/daily-challenge" className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Matokeo →</Link></div> : challenge ? <div className="flex flex-wrap items-center gap-3 p-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"><Trophy className="h-6 w-6" /></div><div className="min-w-0 flex-1"><p className="font-bold text-slate-950 dark:text-white">Changamoto yako iko tayari</p><p className="text-sm text-slate-500 dark:text-slate-400">Maliza quiz ili upate XP na uendeleze streak yako.</p></div><Link href="/learn/daily-challenge" className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-500">Anza sasa</Link></div> : <div className="flex items-center gap-3 p-4"><CalendarDays className="h-8 w-8 text-slate-400" /><p className="flex-1 text-sm text-slate-600 dark:text-slate-300">Daily Challenge ya leo bado haijapangiwa na moderator. Rudi baadaye.</p><Link href="/learn" className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Explore Learn →</Link></div>}
        </section>

        <section className="geometric-card overflow-hidden"><div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3 dark:border-slate-800"><div><h2 className="font-heading text-lg font-extrabold text-slate-950 dark:text-white">Majadiliano ya hivi karibuni</h2><p className="text-xs text-slate-500 dark:text-slate-400">Maswali ya wanafunzi na majibu ya jumuiya</p></div><Link href="/communities?tab=qa" className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">Maswali yote →</Link></div>
          {questions.length ? <ul className="divide-y divide-emerald-50 dark:divide-slate-800">{questions.map((q) => <li key={q.id} className="flex items-start gap-3 p-4"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"><MessageCircleQuestion className="h-4 w-4" /></span><div className="min-w-0 flex-1"><Link href={`/communities/questions/${q.id}`} className="font-bold text-slate-950 hover:text-emerald-700 dark:text-white dark:hover:text-emerald-300">{q.title || (q.body ?? '').slice(0, 96)}</Link><p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{q.body ?? ''}</p><p className="mt-2 text-[11px] text-slate-400">{q.upvotes ?? 0} kura za juu · {prettyDate(q.created_at.slice(0, 10))}</p></div></li>)}</ul> : <div className="p-6 text-center"><MessageCircleQuestion className="mx-auto h-8 w-8 text-emerald-600" /><p className="mt-2 font-bold text-slate-950 dark:text-white">Bado hakuna maswali</p><p className="mt-1 text-sm text-slate-500">Anza mjadala wa kwanza wa somo lako.</p><Link href="/communities?tab=qa&create=question" className="mt-3 inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Uliza swali</Link></div>}
        </section>

        <section className="grid gap-4 lg:grid-cols-2"><div className="geometric-card overflow-hidden"><div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3 dark:border-slate-800"><h2 className="font-heading font-extrabold text-slate-950 dark:text-white">Notes mpya</h2><Link href="/library" className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Maktaba →</Link></div>{notes.length ? <ul className="divide-y divide-emerald-50 dark:divide-slate-800">{notes.map((n) => <li key={n.id} className="p-3"><Link href={`/library/${n.id}?type=notes`} className="font-bold text-slate-950 hover:text-emerald-700 dark:text-white">{n.title}</Link><p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{n.description}</p><span className="mt-2 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{levelLabel(n.level ?? null)}</span></li>)}</ul> : <p className="p-4 text-sm text-slate-500">Notes zilizoidhinishwa zitaonekana hapa.</p>}</div>
          <div className="geometric-card overflow-hidden"><div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3 dark:border-slate-800"><h2 className="font-heading font-extrabold text-slate-950 dark:text-white">Fursa zinazokaribia</h2><Link href="/opportunities" className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Fursa zote →</Link></div>{opportunities.length ? <ul className="divide-y divide-emerald-50 dark:divide-slate-800">{opportunities.map((o) => <li key={o.id} className="p-3"><Link href={`/opportunities/${o.id}`} className="font-bold text-slate-950 hover:text-emerald-700 dark:text-white">{o.title}</Link><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{o.sponsor ?? 'Mfadhili hajatajwa'} · Deadline: {prettyDate(o.deadline ?? null)}</p>{o.verified && <span className="mt-2 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Imethibitishwa</span>}</li>)}</ul> : <p className="p-4 text-sm text-slate-500">Fursa zitakazoidhinishwa zitaonekana hapa.</p>}</div></section>
      </div>

      <aside className="space-y-4 xl:h-full xl:overflow-y-auto xl:overscroll-contain xl:pr-1 no-scrollbar">
        <section className="geometric-card p-4"><div className="flex items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-800 text-white">{profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <GraduationCap className="h-6 w-6" />}</span><div className="min-w-0 flex-1"><h2 className="truncate font-extrabold text-slate-950 dark:text-white">{profile.full_name}</h2><p className="truncate text-xs text-slate-500 dark:text-slate-400">{profile.username ? `@${profile.username} · ` : ''}{levelLabel(profile.level)}</p></div><Link href="/profile" aria-label="Hariri profile" className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-slate-800"><ArrowRight className="h-4 w-4" /></Link></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-emerald-50 p-2 dark:bg-emerald-950/60"><Sparkles className="mx-auto h-4 w-4 text-emerald-700 dark:text-emerald-300" /><p className="mt-1 text-lg font-extrabold text-slate-950 dark:text-white">{profile.xp}</p><p className="text-[10px] text-slate-500">XP</p></div><div className="rounded-xl bg-orange-50 p-2 dark:bg-orange-950/40"><Flame className="mx-auto h-4 w-4 text-orange-600" /><p className="mt-1 text-lg font-extrabold text-slate-950 dark:text-white">{profile.streak}</p><p className="text-[10px] text-slate-500">Streak</p></div><div className="rounded-xl bg-amber-50 p-2 dark:bg-amber-950/40"><Award className="mx-auto h-4 w-4 text-amber-600" /><p className="mt-1 text-lg font-extrabold text-slate-950 dark:text-white">{profile.coins}</p><p className="text-[10px] text-slate-500">Coins</p></div></div></section>
        <section className="geometric-card overflow-hidden"><div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3 dark:border-slate-800"><div><h2 className="font-heading font-extrabold text-slate-950 dark:text-white">Rank ya wiki</h2><p className="text-[11px] text-slate-500 dark:text-slate-400">Wanafunzi waliochagua kuonekana</p></div><Trophy className="h-5 w-5 text-amber-500" /></div>{leaderboardError ? <div role="status" className="p-4 text-sm text-amber-800 dark:text-amber-200"><p className="font-bold">Imeshindikana kupakia leaderboard.</p><p className="mt-1 break-words text-xs">{leaderboardError}</p><p className="mt-2 text-xs">Kagua kama SQL 008 (Flashcards, Achievements na Leaderboard) imeendeshwa kwenye Supabase.</p></div> : leaders.length ? <ol className="space-y-1 p-2">{leaders.map((r) => <li key={r.user_id} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ${r.user_id === user.id ? 'bg-emerald-50 dark:bg-emerald-950/60' : ''}`}><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{r.rank_position}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{r.display_name}{r.user_id === user.id ? ' (Wewe)' : ''}</span><span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">{r.total_xp} XP</span></li>)}</ol> : <div className="p-4 text-sm text-slate-500"><p>Bado hakuna mwanafunzi anayeonekana kwenye leaderboard ya wiki.</p><p className="mt-1 text-xs">Kwenye Profile → Settings, washa “Nionyeshe kwenye leaderboard” kisha uhifadhi. XP ya wiki huongezeka unapokamilisha shughuli zinazotoa pointi.</p></div>}</section>
        <section className="geometric-card p-4"><div className="flex items-center gap-2"><Bell className="h-5 w-5 text-emerald-600" /><h2 className="font-extrabold text-slate-950 dark:text-white">Taarifa</h2><span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-extrabold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{unreadRes.count ?? 0}</span></div><p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Fuata deadline, ujumbe wa jamii na maendeleo ya nyenzo ulizopakia.</p><Link href="/notifications" className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">Fungua taarifa <ArrowRight className="h-3.5 w-3.5" /></Link></section>
        <section className="geometric-card p-4"><div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-emerald-600" /><h2 className="font-extrabold text-slate-950 dark:text-white">Past papers</h2></div>{papers.length ? <ul className="mt-3 space-y-2">{papers.map((p) => <li key={p.id}><Link href={`/library/${p.id}?type=past_papers`} className="block rounded-xl p-2 transition hover:bg-emerald-50 dark:hover:bg-slate-800"><span className="block text-sm font-bold text-slate-900 dark:text-white">{p.title}</span><span className="mt-1 block text-[11px] text-slate-500">{p.exam_type} · {p.year} · {levelLabel(p.level ?? null)}</span></Link></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">Past papers zitaonekana hapa baada ya kuidhinishwa.</p>}</section>
      </aside>
    </div>
  )
}
