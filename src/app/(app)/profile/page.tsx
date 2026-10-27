import Link from 'next/link'
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { Award, CalendarDays, Flame, GraduationCap, Mail, MapPin, ShieldCheck, Sparkles, Trophy, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/(app)/actions'
import ThemeToggle from '@/components/layout/ThemeToggle'
import ProfileSettingsPanel from '@/components/profile/ProfileSettingsPanel'
import { isStaffUser } from '@/lib/admin'
import { SMARTNEKAM_PAYMENTS_ENABLED } from '@/lib/payments/feature'

const ROLE_LABELS: Record<string,string> = { student:'Mwanafunzi', mentor:'Mentor', teacher:'Mwalimu / Tutor', school_admin:'Msimamizi wa shule', parent:'Mzazi', moderator:'Moderator', super_admin:'Super Admin' }
const LEVEL_LABELS: Record<string,string> = { O_LEVEL:'O-Level', A_LEVEL:'A-Level', UNIVERSITY:'University' }
function initials(name:string){return name.trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()??'').join('')||'S'}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')
  const { data: profile } = await supabase.from('profiles').select('id,full_name,username,bio,avatar_url,cover_url,institution_name,email,role,level,form_or_year,school_id,university_id,combination,course,region,xp,coins,streak,longest_streak,referral_code,created_at,show_on_leaderboard').eq('id',user.id).maybeSingle()
  if (!profile) redirect('/onboarding')
  const [schoolRes,universityRes,subjectRes,prefsRes,privacyRes,walletRes,certRes,achievementRes] = await Promise.all([
    profile.school_id ? supabase.from('schools').select('name').eq('id',profile.school_id).maybeSingle() : Promise.resolve({data:null}),
    profile.university_id ? supabase.from('universities').select('name').eq('id',profile.university_id).maybeSingle() : Promise.resolve({data:null}),
    supabase.from('profile_subjects').select('subject_id,subjects(name)').eq('profile_id',user.id),
    supabase.from('user_app_preferences').select('language_code,low_data_mode').eq('user_id',user.id).maybeSingle(),
    supabase.from('user_privacy_settings').select('profile_visibility,show_in_leaderboards').eq('user_id',user.id).maybeSingle(),
    supabase.from('wallet_accounts').select('id,currency,available_balance,status').eq('profile_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    supabase.from('certificates').select('id,certificate_code,title,certificate_type,status,issued_at').eq('recipient_id',user.id).order('issued_at',{ascending:false}).limit(6),
    supabase.from('user_achievements').select('id,achievement_id,awarded_at,achievements(name_sw,name_en,icon_key,xp_reward)').eq('user_id',user.id).order('awarded_at',{ascending:false}).limit(6),
  ])
  const subjects = (subjectRes.data ?? []) as { subject_id:string; subjects:{name:string}|{name:string}[]|null }[]
  const subjectNames = subjects.map(row => Array.isArray(row.subjects)?row.subjects[0]?.name:row.subjects?.name).filter((n):n is string=>Boolean(n))
  const certificates = certRes.data ?? []
  const achievements = (achievementRes.data ?? []) as { id:string; achievement_id:string; awarded_at:string; achievements:{name_sw:string|null;name_en:string|null;icon_key:string|null;xp_reward:number}|{name_sw:string|null;name_en:string|null;icon_key:string|null;xp_reward:number}[]|null }[]
  const isStaff = isStaffUser(profile.role,user.email)
  const joined = new Date(user.created_at).toLocaleDateString('sw-TZ',{year:'numeric',month:'long',timeZone:'Africa/Dar_es_Salaam'})
  const institute = schoolRes.data?.name ?? universityRes.data?.name ?? profile.institution_name ?? null

  return <div className="stagger mx-auto max-w-4xl space-y-5">
    <section className="geometric-card overflow-visible">
      <div className="geometric-hero relative h-36 overflow-visible rounded-t-3xl sm:h-48">
        {profile.cover_url && <img src={profile.cover_url} alt="Cover picha ya profile" className="absolute inset-0 h-full w-full rounded-t-3xl object-cover" />}
        <div className="absolute inset-0 rounded-t-3xl bg-gradient-to-r from-[#111827]/60 via-[#111827]/20 to-transparent" />
        <div className="absolute -right-8 -top-12 h-48 w-48 rounded-full border-[28px] border-white/10" />
        <div className="absolute left-5 top-4 text-[10px] font-extrabold uppercase tracking-[.18em] text-emerald-100 drop-shadow sm:text-xs">SmartNekam · Student Profile</div>
        <div className="absolute bottom-0 left-5 z-20 flex h-24 w-24 translate-y-1/2 items-center justify-center overflow-visible rounded-full bg-gradient-to-br from-emerald-500 to-emerald-900 text-2xl font-black text-white ring-4 ring-white shadow-xl dark:ring-[#131d31]">
          {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.full_name ?? 'Picha ya mwanafunzi'} className="h-full w-full rounded-full object-cover" /> : initials(profile.full_name ?? '')}
        </div>
      </div>
      <div className="px-5 pb-5 pt-14">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black text-slate-950 dark:text-white">{profile.full_name}</h1>
            <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">@{profile.username}</p>
          </div>
          <span className="mt-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{ROLE_LABELS[profile.role] ?? profile.role}</span>
        </div>
        {profile.bio && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{profile.bio}</p>}
        <p className="mt-1 text-sm text-slate-500">{LEVEL_LABELS[profile.level ?? ''] ?? 'Kiwango hakijawekwa'}{profile.form_or_year ? ` · ${profile.form_or_year}` : ''}{profile.combination ? ` · ${profile.combination}` : ''}{profile.course ? ` · ${profile.course}` : ''}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
          {institute && <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 text-emerald-600" />{institute}</span>}
          {profile.region && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-emerald-600" />{profile.region}</span>}
          {user.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-emerald-600" />{user.email}</span>}
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-emerald-600" /> Mwanachama tangu {joined}</span>
        </div>
        {subjectNames.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{subjectNames.map(name => <span key={name} className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">{name}</span>)}</div>}
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat icon={<Sparkles className="h-5 w-5"/>} title="Jumla ya XP" value={Number(profile.xp).toLocaleString()} tone="amber"/><Stat icon={<Wallet className="h-5 w-5"/>} title="Coins" value={Number(profile.coins).toLocaleString()} tone="violet"/><Stat icon={<Flame className="h-5 w-5"/>} title="Streak ya sasa" value={`${profile.streak} siku`} tone="orange"/><Stat icon={<Trophy className="h-5 w-5"/>} title="Streak bora" value={`${profile.longest_streak} siku`} tone="orange"/></section>

    <section className="grid gap-4 lg:grid-cols-2">
      {SMARTNEKAM_PAYMENTS_ENABLED && (
        <div id="wallet" className="geometric-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg font-extrabold text-slate-950 dark:text-white">Wallet</h2>
              <p className="mt-1 text-xs text-slate-500">Wallet ya malipo ya SmartNekam.</p>
            </div>
            <Wallet className="h-6 w-6 text-emerald-600" />
          </div>
          <p className="mt-5 text-3xl font-black text-slate-950 dark:text-white">
            {Number(walletRes.data?.available_balance ?? 0).toLocaleString()} <span className="text-sm font-bold text-slate-500">{walletRes.data?.currency ?? 'TZS'}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">Hali: {walletRes.data?.status ?? 'Bado haijafunguliwa'}</p>
          <Link href="/wallet" className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white">Fungua wallet</Link>
        </div>
      )}
      <div className="geometric-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-extrabold text-slate-950 dark:text-white">Vyeti vya SmartNekam</h2>
            <p className="mt-1 text-xs text-slate-500">QR verification na historia ya mafanikio.</p>
          </div>
          <Award className="h-6 w-6 text-amber-500" />
        </div>
        {certificates.length ? (
          <div className="mt-4 space-y-2">
            {certificates.map(c => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                <Award className="h-5 w-5 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{c.title}</p>
                  <p className="text-xs text-slate-500">{c.certificate_code} · {c.status}</p>
                </div>
                <Link href={`/verify/${encodeURIComponent(c.certificate_code)}`} className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Thibitisha</Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-slate-500">Bado huna cheti. Vyeti vitaonekana baada ya kukamilisha shughuli zinazostahili au mashindano.</p>
        )}
      </div>
    </section>

    <section className="geometric-card p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-heading text-lg font-extrabold text-slate-950 dark:text-white">Beji na achievements</h2><p className="mt-1 text-xs text-slate-500">Mafanikio yaliyotolewa kwenye akaunti yako.</p></div><Trophy className="h-6 w-6 text-amber-500"/></div>{achievements.length?<div className="mt-4 grid gap-2 sm:grid-cols-2">{achievements.map(a=>{const item=Array.isArray(a.achievements)?a.achievements[0]:a.achievements;return <div key={a.id} className="flex items-center gap-3 rounded-xl border border-emerald-100 p-3 dark:border-slate-800"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200"><Award className="h-5 w-5"/></span><div><p className="font-bold text-slate-900 dark:text-white">{item?.name_sw??item?.name_en??'Achievement'}</p><p className="text-xs text-slate-500">+{item?.xp_reward??0} XP</p></div></div>})}</div>:<p className="mt-4 text-sm text-slate-500">Achievements zitajitokeza hapa zinapotolewa na mfumo.</p>}</section>

    <ProfileSettingsPanel userId={user.id} fullName={profile.full_name??''} username={profile.username??''} bio={profile.bio??''} avatarUrl={profile.avatar_url??null} coverUrl={profile.cover_url??null} level={profile.level} formOrYear={profile.form_or_year} combination={profile.combination} course={profile.course} region={profile.region} showOnLeaderboard={Boolean(profile.show_on_leaderboard)} languageCode={prefsRes.data?.language_code??'sw'} lowDataMode={Boolean(prefsRes.data?.low_data_mode)} profileVisibility={privacyRes.data?.profile_visibility??'community'}/>

    <section className="geometric-card divide-y divide-emerald-100 dark:divide-slate-800"> <div className="flex items-center justify-between p-4"><div><p className="font-semibold text-slate-900 dark:text-white">Mwonekano</p><p className="text-xs text-slate-500">Chagua Dark, Light, System au AMOLED Black.</p></div><ThemeToggle/></div>{isStaff&&<Link href="/admin" className="flex items-center gap-2 p-4 text-sm font-semibold text-slate-800 transition hover:bg-emerald-50 dark:text-slate-100 dark:hover:bg-slate-800"><ShieldCheck className="h-4 w-4 text-emerald-600"/> Admin Panel</Link>}<form action={signOut}><button className="flex w-full items-center gap-2 p-4 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-slate-800">Ondoka</button></form></section>
  </div>
}
function Stat({icon,title,value,tone}:{icon:ReactNode;title:string;value:string;tone:'amber'|'violet'|'orange'|'green'}){const tones={amber:'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200',violet:'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200',orange:'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-200',green:'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200'};return <div className="geometric-card flex items-center gap-3 p-4"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span><div><p className="text-xs text-slate-500">{title}</p><p className="mt-1 text-xl font-black text-slate-950 dark:text-white">{value}</p></div></div>}
