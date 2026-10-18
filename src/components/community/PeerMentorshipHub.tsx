'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BookOpenCheck, CalendarClock, CheckCircle2, GraduationCap, Loader2,
  MessageCircle, ShieldCheck, UserRound, Users, X, Send, BookOpen,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Mentor = {
  id: string
  user_id: string
  display_name: string
  headline: string | null
  bio: string | null
  subjects: string[] | null
  hourly_rate: number | null
  verified: boolean
  status: string
  rating_average: number
}
type SessionRequest = {
  id: string
  mentor_id: string
  student_id: string
  scheduled_at: string
  duration_minutes: number
  topic: string
  student_message: string | null
  status: string
  chat_conversation_id?: string | null
  created_at?: string
  student_name?: string
  student_level?: string | null
}

const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-emerald-900/30'

function localDateTime(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function levelText(level: string | null | undefined) {
  if (level === 'O_LEVEL') return 'O-Level'
  if (level === 'A_LEVEL') return 'A-Level'
  if (level === 'UNIVERSITY') return 'University'
  return 'Mwanafunzi'
}

function statusText(status: string) {
  const labels: Record<string, string> = {
    requested: 'Inasubiri jibu', accepted: 'Imekubaliwa', declined: 'Imekataliwa',
    cancelled: 'Imefutwa', completed: 'Imekamilika', no_show: 'Hakuhudhuria',
    pending_review: 'Inasubiri uhakiki', active: 'Imethibitishwa', rejected: 'Haijaidhinishwa',
    inactive: 'Haipo hewani', suspended: 'Imesimamishwa',
  }
  return labels[status] ?? status
}

export default function PeerMentorshipHub({
  mentors,
  currentUserId,
  currentName,
  currentLevel,
}: {
  mentors: Mentor[]
  currentUserId: string
  currentName: string
  currentLevel: string | null
}) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [myMentor, setMyMentor] = useState<Mentor | null>(null)
  const [incoming, setIncoming] = useState<SessionRequest[]>([])
  const [myRequests, setMyRequests] = useState<SessionRequest[]>([])
  const [applyOpen, setApplyOpen] = useState(false)
  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [subjectsText, setSubjectsText] = useState('')
  const [applying, setApplying] = useState(false)
  const [requestTarget, setRequestTarget] = useState<Mentor | null>(null)
  const [topic, setTopic] = useState('')
  const [studentMessage, setStudentMessage] = useState('')
  const [scheduledAt, setScheduledAt] = useState(() => localDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000)))
  const [requesting, setRequesting] = useState(false)
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: ownMentor } = await supabase.from('mentors')
        .select('id,user_id,display_name,headline,bio,subjects,hourly_rate,verified,status,rating_average')
        .eq('user_id', currentUserId).maybeSingle()
      if (cancelled) return
      const own = ownMentor as Mentor | null
      setMyMentor(own)

      if (own) {
        const { data: sessions } = await supabase.from('mentor_sessions')
          .select('id,mentor_id,student_id,scheduled_at,duration_minutes,topic,student_message,status,chat_conversation_id,created_at')
          .eq('mentor_id', own.id).order('created_at', { ascending: false }).limit(8)
        if (!cancelled) {
          const rows = (sessions ?? []) as SessionRequest[]
          const ids = [...new Set(rows.map((r) => r.student_id))]
          const { data: profiles } = ids.length
            ? await supabase.from('profiles').select('id,full_name,level').in('id', ids)
            : { data: [] as { id: string; full_name: string | null; level: string | null }[] }
          const byId = new Map((profiles ?? []).map((p) => [p.id, p]))
          if (!cancelled) setIncoming(rows.map((r) => ({ ...r, student_name: byId.get(r.student_id)?.full_name ?? 'Mwanafunzi', student_level: byId.get(r.student_id)?.level ?? null })))
        }
      } else {
        setIncoming([])
      }

      const { data: requests } = await supabase.from('mentor_sessions')
        .select('id,mentor_id,student_id,scheduled_at,duration_minutes,topic,student_message,status,chat_conversation_id,created_at')
        .eq('student_id', currentUserId).order('created_at', { ascending: false }).limit(6)
      if (!cancelled) setMyRequests((requests ?? []) as SessionRequest[])
    }
    void load()
    return () => { cancelled = true }
  }, [currentUserId, refreshKey, supabase])

  async function applyAsMentor(e: FormEvent) {
    e.preventDefault()
    setError(''); setNotice('')
    if (currentLevel !== 'UNIVERSITY') {
      setError('Kuomba kuwa mentor wa wanafunzi wa level za chini kunaruhusiwa kwa akaunti ya University pekee.')
      return
    }
    const subjects = [...new Set(subjectsText.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 12)
    if (subjects.length === 0) { setError('Weka angalau somo au eneo moja unaloweza kusaidia.'); return }
    if (bio.trim().length < 30) { setError('Bio iwe na angalau herufi 30 ili wanafunzi wajue unachoweza kufundisha.'); return }
    setApplying(true)
    const { error: insertError } = await supabase.from('mentors').insert({
      user_id: currentUserId,
      display_name: currentName,
      headline: headline.trim(),
      bio: bio.trim(),
      subjects,
      hourly_rate: 0,
      currency: 'TZS',
    })
    if (insertError) {
      setError(insertError.message.includes('duplicate') || insertError.code === '23505'
        ? 'Tayari una mentor profile. Angalia hali iliyoonyeshwa hapa.'
        : `Imeshindikana kutuma ombi: ${insertError.message}`)
    } else {
      setNotice('Ombi lako limetumwa kwa uhakiki. Likithibitishwa, wanafunzi wataweza kukuomba ushauri wa bure.')
      setApplyOpen(false)
      setRefreshKey((v) => v + 1)
    }
    setApplying(false)
  }

  async function submitRequest(e: FormEvent) {
    e.preventDefault()
    if (!requestTarget) return
    setError(''); setNotice('')
    const when = new Date(scheduledAt)
    if (!Number.isFinite(when.getTime()) || when.getTime() <= Date.now()) {
      setError('Chagua muda wa baadaye kuanzia sasa.')
      return
    }
    if (topic.trim().length < 4) { setError('Eleza mada unayohitaji msaada.') ; return }
    setRequesting(true)
    const { error: requestError } = await supabase.from('mentor_sessions').insert({
      mentor_id: requestTarget.id,
      student_id: currentUserId,
      scheduled_at: when.toISOString(),
      duration_minutes: 30,
      session_format: 'online',
      topic: topic.trim(),
      student_message: studentMessage.trim() || null,
    })
    if (requestError) {
      setError(`Ombi halikutumwa: ${requestError.message}`)
    } else {
      setNotice(`Ombi la ushauri limetumwa kwa ${requestTarget.display_name}. Utapata chat ikiwa ombi litakubaliwa.`)
      setRequestTarget(null); setTopic(''); setStudentMessage('')
      setRefreshKey((v) => v + 1)
    }
    setRequesting(false)
  }

  async function respondToRequest(session: SessionRequest, accept: boolean) {
    setError(''); setNotice(''); setRespondingId(session.id)
    const { data: conversationId, error: responseError } = await supabase.rpc('respond_to_mentor_session', {
      p_session_id: session.id,
      p_accept: accept,
      p_meeting_url: null,
      p_mentor_message: accept ? 'Karibu! Tutawasiliana kupitia chat ya SmartNekam.' : 'Asante kwa kuomba ushauri. Kwa sasa sitaweza kukuchukua.',
    })
    if (responseError) {
      setError(`Imeshindikana kujibu ombi: ${responseError.message}`)
    } else if (accept && typeof conversationId === 'string' && conversationId.length > 0) {
      // The RPC returns the private conversation created for this exact applicant.
      // Open it immediately so the mentor sees the applicant's profile name in chat.
      router.push(`/communities?tab=chats&conversation=${encodeURIComponent(conversationId)}`)
    } else {
      setNotice(accept ? 'Ombi limekubaliwa, lakini chat ID haikurudi. Hakikisha SQL ya mentorship (006) na chat inbox (018) zimeendeshwa.' : 'Umejibu ombi hilo.')
      setRefreshKey((v) => v + 1)
    }
    setRespondingId(null)
  }

  const list = mentors.filter((mentor) => mentor.user_id !== currentUserId)
  const minDate = localDateTime(new Date(Date.now() + 30 * 60 * 1000))

  return <div className="space-y-5">
    <section className="geometric-card overflow-hidden">
      <div className="geometric-hero relative overflow-hidden p-5 text-white sm:p-7">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.16em]"><GraduationCap className="h-4 w-4"/> Peer mentorship</div>
          <h2 className="mt-3 text-2xl font-black sm:text-3xl">Mwanachuo akusaidie kupiga hatua</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">Wanachuo wanaweza kutoa mwongozo wa masomo, uchaguzi wa kozi, maandalizi ya mitihani na maisha ya chuo. Omba kipindi cha bure; mentor akikubali, chat ya faragha hufunguliwa.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-white/15 px-3 py-1.5">Masomo</span><span className="rounded-full bg-white/15 px-3 py-1.5">Career & vyuo</span><span className="rounded-full bg-white/15 px-3 py-1.5">Ushauri wa bure</span></div>
        </div>
        <BookOpenCheck className="absolute -bottom-7 -right-3 h-36 w-36 text-white/10"/>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
        <div className="flex gap-3 rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-950/40"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"><Users className="h-5 w-5"/></span><div><p className="text-sm font-extrabold text-slate-900 dark:text-white">Ungana moja kwa moja</p><p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">Omba kipindi; chat hufunguliwa baada ya kukubaliwa.</p></div></div>
        <div className="flex gap-3 rounded-2xl bg-sky-50 p-3 dark:bg-sky-950/30"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200"><BookOpen className="h-5 w-5"/></span><div><p className="text-sm font-extrabold text-slate-900 dark:text-white">Mafunzo yanayoeleweka</p><p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">Pata maelekezo ya hatua kwa hatua na mbinu za kujisomea.</p></div></div>
        <div className="flex gap-3 rounded-2xl bg-amber-50 p-3 dark:bg-amber-950/30"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"><ShieldCheck className="h-5 w-5"/></span><div><p className="text-sm font-extrabold text-slate-900 dark:text-white">Uhakiki kwanza</p><p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">Mentor huonekana baada ya uhakiki wa SmartNekam.</p></div></div>
      </div>
    </section>

    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">{notice}</p>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>}

    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-heading text-xl font-black text-slate-950 dark:text-white">Wanachuo wanaoweza kusaidia</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Mentors waliopitiwa na SmartNekam. Vipindi vya peer mentorship ni bure.</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{list.length} mentors</span></div>
      {list.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{list.map((mentor) => <article key={mentor.id} className="geometric-card hover-lift flex flex-col p-4">
        <div className="flex items-start gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><GraduationCap className="h-6 w-6"/></span><div className="min-w-0 flex-1"><h3 className="font-extrabold text-slate-950 dark:text-white">{mentor.display_name || 'Mwanachuo mentor'}</h3><p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">{mentor.headline || 'Peer mentor wa SmartNekam'}</p></div><span className="rounded-full bg-teal-100 px-2 py-1 text-[10px] font-extrabold text-teal-800 dark:bg-teal-950 dark:text-teal-200">Verified</span></div>
        <p className="mt-3 line-clamp-4 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{mentor.bio || 'Nipo tayari kusaidia masomo na kuelekeza hatua za elimu.'}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">{(mentor.subjects ?? []).map((subject) => <span key={subject} className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">{subject}</span>)}</div>
        <div className="mt-4 flex items-center justify-between border-t border-emerald-50 pt-3 dark:border-slate-800"><span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Bure · 30 dakika</span><span className="text-xs text-amber-600">★ {Number(mentor.rating_average ?? 0).toFixed(1)}</span></div>
        <button type="button" onClick={() => { setRequestTarget(mentor); setTopic(''); setStudentMessage(''); setError(''); setNotice('') }} className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-extrabold text-white transition hover:bg-emerald-500"><MessageCircle className="h-4 w-4"/> Omba ushauri wa bure</button>
      </article>)}</div> : <div className="geometric-card p-6 text-center"><GraduationCap className="mx-auto h-9 w-9 text-emerald-600"/><h3 className="mt-2 font-extrabold text-slate-900 dark:text-white">Mentor wa kwanza anaweza kuwa wewe</h3><p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-slate-500">Kwa sasa hakuna mentor aliyethibitishwa. Wanachuo wanaweza kujiandikisha hapa chini; baada ya uhakiki wataonekana kwa wanafunzi wa O-Level na A-Level.</p></div>}
    </section>

    {myMentor && <section className="geometric-card p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-heading text-lg font-black text-slate-950 dark:text-white">Wasifu wako wa mentor</h2><p className="mt-1 text-sm text-slate-500">{myMentor.headline || 'Peer mentor'}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${myMentor.status === 'active' && myMentor.verified ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'}`}>{statusText(myMentor.status)}</span></div>
      {myMentor.status === 'active' && myMentor.verified && <div className="mt-4 space-y-2"><h3 className="font-extrabold text-slate-900 dark:text-white">Maombi ya vipindi</h3>{incoming.length ? incoming.map((request) => <div key={request.id} className="rounded-2xl border border-emerald-100 p-3 dark:border-slate-800"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold text-slate-900 dark:text-white">{request.student_name} · {levelText(request.student_level)}</p><p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">{request.topic}</p><p className="mt-1 text-xs text-slate-500">{new Date(request.scheduled_at).toLocaleString('sw-TZ', { dateStyle: 'medium', timeStyle: 'short' })} · dakika {request.duration_minutes}</p>{request.student_message && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{request.student_message}</p>}</div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{statusText(request.status)}</span></div>
        {request.status === 'requested' && <div className="mt-3 flex gap-2"><button type="button" disabled={respondingId === request.id} onClick={() => void respondToRequest(request, true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50">{respondingId === request.id ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <CheckCircle2 className="h-3.5 w-3.5"/>} Kubali</button><button type="button" disabled={respondingId === request.id} onClick={() => void respondToRequest(request, false)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-700 dark:border-slate-700 dark:text-slate-200">Kataa</button></div>}
        {request.status === 'accepted' && request.chat_conversation_id && <Link href={`/communities?tab=chats&conversation=${request.chat_conversation_id}`} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white"><MessageCircle className="h-3.5 w-3.5"/> Fungua chat</Link>}
      </div>) : <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-900">Hakuna maombi mapya kwa sasa.</p>}</div>}
    </section>}

    {myRequests.length > 0 && <section className="geometric-card p-4 sm:p-5"><h2 className="font-heading text-lg font-black text-slate-950 dark:text-white">Maombi yako ya mentorship</h2><div className="mt-3 space-y-2">{myRequests.map((request) => { const mentor = mentors.find((m) => m.id === request.mentor_id); return <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"><div><p className="font-bold text-slate-900 dark:text-white">{mentor?.display_name ?? 'Peer mentor'} · {request.topic}</p><p className="mt-1 text-xs text-slate-500">{new Date(request.scheduled_at).toLocaleString('sw-TZ', { dateStyle: 'medium', timeStyle: 'short' })}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${request.status === 'accepted' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>{statusText(request.status)}</span>{request.status === 'accepted' && request.chat_conversation_id && <Link href={`/communities?tab=chats&conversation=${request.chat_conversation_id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white"><MessageCircle className="h-3.5 w-3.5"/> Fungua chat</Link>}</div> })}</div></section>}

    {currentLevel === 'UNIVERSITY' && !myMentor && <section className="geometric-card p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><UserRound className="h-5 w-5"/></span><div><h2 className="font-heading text-lg font-black text-slate-950 dark:text-white">Kuwa mentor wa kizazi kinachofuata</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Shiriki maarifa ya chuo, masomo na career kwa wanafunzi wa O-Level na A-Level. Ni huduma ya kujitolea.</p></div></div><button type="button" onClick={() => setApplyOpen((v) => !v)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white">{applyOpen ? 'Funga fomu' : 'Omba kuwa mentor'}</button></div>
      {applyOpen && <form onSubmit={applyAsMentor} className="mt-4 space-y-3 border-t border-emerald-100 pt-4 dark:border-slate-800"><label className="block"><span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Kichwa / utaalamu</span><input className={field} required minLength={4} maxLength={180} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Mfano: Mwanachuo wa Uhandisi, Physics na Mathematics"/></label><label className="block"><span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Masomo au maeneo unayoweza kusaidia (tenganisha kwa koma)</span><input className={field} required value={subjectsText} onChange={(e) => setSubjectsText(e.target.value)} placeholder="Mathematics, Physics, uchaguzi wa kozi, application za chuo"/></label><label className="block"><span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Kujitambulisha na aina ya ushauri unaoweza kutoa</span><textarea className={field} required minLength={30} maxLength={3000} rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Eleza uzoefu wako, kozi unayosoma na namna utakavyowasaidia wanafunzi..."/></label><button type="submit" disabled={applying} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">{applying ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>} Tuma kwa uhakiki</button><p className="text-xs leading-5 text-slate-500">Kadi yako haitakuwa public mpaka moderator aihakiki. Hakuna malipo ya peer mentoring.</p></form>}
    </section>}

    {currentLevel !== 'UNIVERSITY' && !myMentor && <p className="rounded-xl border border-slate-200 p-3 text-xs leading-5 text-slate-500 dark:border-slate-800">Mwanachuo wa University anaweza kuomba kuwa peer mentor. Wewe bado unaweza kuomba ushauri kwa mentor yeyote aliyehakikiwa hapo juu.</p>}

    {requestTarget && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center"><section role="dialog" aria-modal="true" aria-labelledby="mentor-request-title" className="anim-sheet-up geometric-card relative w-full max-w-lg rounded-3xl p-4 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-700 dark:text-emerald-300">Peer mentorship · Bure</p><h2 id="mentor-request-title" className="mt-1 text-xl font-black text-slate-950 dark:text-white">Omba ushauri kwa {requestTarget.display_name}</h2><p className="mt-1 text-sm text-slate-500">Kipindi cha dakika 30, kupitia chat ya SmartNekam.</p></div><button type="button" onClick={() => setRequestTarget(null)} aria-label="Funga" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5"/></button></div><form onSubmit={submitRequest} className="mt-4 space-y-3"><label className="block"><span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Mada unayohitaji msaada</span><input className={field} required minLength={4} maxLength={180} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Mfano: Jinsi ya kujiandaa na Physics"/></label><label className="block"><span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Tarehe na muda unaopendekeza</span><input type="datetime-local" className={field} required min={minDate} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}/></label><label className="block"><span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Ujumbe kwa mentor (hiari)</span><textarea className={field} rows={3} maxLength={1500} value={studentMessage} onChange={(e) => setStudentMessage(e.target.value)} placeholder="Eleza unachokifahamu tayari au swali lako..."/></label>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>}<div className="flex gap-2"><button type="button" onClick={() => setRequestTarget(null)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Ghairi</button><button type="submit" disabled={requesting} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">{requesting ? <Loader2 className="h-4 w-4 animate-spin"/> : <CalendarClock className="h-4 w-4"/>} Tuma ombi</button></div></form></section></div>}
  </div>
}
