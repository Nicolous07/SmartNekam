'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, GraduationCap, Loader2, School, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import InstitutionSearchField from '@/components/institutions/InstitutionSearchField'

type Level = 'O_LEVEL' | 'A_LEVEL' | 'UNIVERSITY'
type Subject = { id: string; name: string; level: Level }
const LEVELS: { value: Level; label: string; description: string }[] = [
  { value: 'O_LEVEL', label: 'O-Level', description: 'Kidato cha I–IV' },
  { value: 'A_LEVEL', label: 'A-Level', description: 'Kidato cha V–VI' },
  { value: 'UNIVERSITY', label: 'University', description: 'Chuo kikuu au college' },
]
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-emerald-900/40'
const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200'

export default function OnboardingWizard() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [fullName, setFullName] = useState('')
  const [level, setLevel] = useState<Level | ''>('')
  const [formOrYear, setFormOrYear] = useState('')
  const [combination, setCombination] = useState('')
  const [course, setCourse] = useState('')
  const [region, setRegion] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [schoolId, setSchoolId] = useState('')
  const [universityId, setUniversityId] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [referralCode, setReferralCode] = useState('')
  const [loadingReferences, setLoadingReferences] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoadingReferences(true)
      const [subjectResult, userResult] = await Promise.all([
        supabase.from('subjects').select('id,name,level').order('name'),
        supabase.auth.getUser(),
      ])
      if (!alive) return
      setSubjects((subjectResult.data ?? []) as Subject[])
      if (userResult.data.user) {
        const { data: profile } = await supabase.from('profiles').select('full_name,level,form_or_year,school_id,university_id,combination,course,region').eq('id', userResult.data.user.id).maybeSingle()
        if (alive && profile) {
          setFullName(profile.full_name ?? '')
          setLevel((profile.level as Level | null) ?? '')
          setFormOrYear(profile.form_or_year ?? '')
          setSchoolId(profile.school_id ?? '')
          setUniversityId(profile.university_id ?? '')
          setCombination(profile.combination ?? '')
          setCourse(profile.course ?? '')
          setRegion(profile.region ?? '')
          const { data: picked } = await supabase.from('profile_subjects').select('subject_id').eq('profile_id', userResult.data.user.id)
          if (alive) setSelectedSubjects((picked ?? []).map((r) => r.subject_id))
        }
      }
      setLoadingReferences(false)
    }
    void load()
    return () => { alive = false }
  }, [supabase])

  const levelSubjects = subjects.filter((subject) => subject.level === level)
  const isLevelInfoValid = Boolean(level) && (level === 'UNIVERSITY' ? course.trim().length >= 2 && formOrYear.trim() !== '' : formOrYear.trim() !== '') && (levelSubjects.length === 0 || selectedSubjects.length > 0)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (fullName.trim().length < 3) { setError('Andika jina lako kamili.'); setStep(1); return }
    if (!level) { setError('Chagua kiwango chako cha elimu.'); setStep(2); return }
    if (!isLevelInfoValid) { setError('Kamilisha taarifa za kiwango, mwaka/kidato, kozi na masomo.'); setStep(2); return }
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Hujaingia. Tafadhali ingia tena.')
      const update = {
        full_name: fullName.trim(),
        level,
        form_or_year: formOrYear.trim(),
        school_id: level === 'UNIVERSITY' ? null : (schoolId || null),
        university_id: level === 'UNIVERSITY' ? (universityId || null) : null,
        combination: level === 'A_LEVEL' ? (combination.trim() || null) : null,
        course: level === 'UNIVERSITY' ? course.trim() : null,
        region: region.trim() || null,
      }
      const { error: profileError } = await supabase.from('profiles').update(update).eq('id', user.id)
      if (profileError) throw profileError
      const { error: removeError } = await supabase.from('profile_subjects').delete().eq('profile_id', user.id)
      if (removeError) throw removeError
      if (selectedSubjects.length) {
        const { error: subjectError } = await supabase.from('profile_subjects').insert(selectedSubjects.map((subject_id) => ({ profile_id: user.id, subject_id })))
        if (subjectError) throw subjectError
      }
      if (referralCode.trim()) {
        const { error: referralError } = await supabase.rpc('apply_referral_code', { p_code: referralCode.trim() })
        // Referral is optional; profile onboarding should still finish if the code is invalid.
        if (referralError) console.warn('Referral code was not applied:', referralError.message)
      }
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Imeshindikana kuhifadhi taarifa. Jaribu tena.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) return <section className="anim-pop geometric-card mx-auto max-w-xl p-8 text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-white"><Check className="h-8 w-8" /></span><h1 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">Karibu SmartNekam!</h1><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Wasifu wako umehifadhiwa. Sasa unaweza kuona nyenzo na fursa zinazoendana na kiwango chako.</p><button onClick={() => { router.push('/dashboard'); router.refresh() }} className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-emerald-500">Fungua dashboard <ArrowRight className="ml-1 inline h-4 w-4" /></button></section>

  return <div className="mx-auto max-w-2xl space-y-5">
    <section className="geometric-hero relative overflow-hidden rounded-3xl p-6 text-white sm:p-8"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-emerald-100">Soma · Ungana · Pata Fursa</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">Tujenge safari yako ya kujifunza.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-emerald-50">Taarifa hizi hutusaidia kupendekeza notes, study groups na fursa zinazohusiana na elimu yako.</p><div className="mt-5 flex items-center gap-2">{[1,2,3].map((n)=><span key={n} className={`h-2 flex-1 rounded-full ${step >= n ? 'bg-emerald-300' : 'bg-white/25'}`} />)}</div><p className="mt-2 text-xs text-emerald-100">Hatua {step} kati ya 3</p></section>
    <form onSubmit={submit} className="geometric-card space-y-5 p-5 sm:p-7">
      {step === 1 && <div className="anim-slide-left space-y-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><UserRound className="h-5 w-5" /></span><div><h2 className="font-extrabold text-slate-950 dark:text-white">Taarifa zako</h2><p className="text-xs text-slate-500">Jina litaonekana kwenye profile yako.</p></div></div><label className="block"><span className={labelClass}>Jina kamili</span><input value={fullName} onChange={(e)=>setFullName(e.target.value)} required minLength={3} maxLength={120} className={inputClass} placeholder="Mfano: Asha Juma" /></label><label className="block"><span className={labelClass}>Mkoa (hiari)</span><input value={region} onChange={(e)=>setRegion(e.target.value)} maxLength={80} className={inputClass} placeholder="Mfano: Dar es Salaam" /></label><button type="button" onClick={()=>{ if (fullName.trim().length < 3) setError('Andika jina kamili kwanza.'); else { setError(''); setStep(2) } }} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white">Endelea <ArrowRight className="ml-1 inline h-4 w-4"/></button></div>}
      {step === 2 && <div className="anim-slide-left space-y-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"><GraduationCap className="h-5 w-5" /></span><div><h2 className="font-extrabold text-slate-950 dark:text-white">Kiwango cha elimu</h2><p className="text-xs text-slate-500">Chagua kiwango kinachokuhusu.</p></div></div><div className="grid gap-2 sm:grid-cols-3">{LEVELS.map((item)=><button key={item.value} type="button" onClick={()=>{setLevel(item.value);setSelectedSubjects([]);setSchoolId('');setUniversityId('')}} className={`rounded-2xl border-2 p-4 text-left transition ${level===item.value?'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40':'border-slate-200 hover:border-emerald-300 dark:border-slate-700'}`}><BookOpen className={`h-5 w-5 ${level===item.value?'text-emerald-700':'text-slate-400'}`}/><span className="mt-3 block font-extrabold text-slate-950 dark:text-white">{item.label}</span><span className="mt-1 block text-xs text-slate-500">{item.description}</span></button>)}</div>{level && <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className={labelClass}>{level==='UNIVERSITY'?'Mwaka wa masomo':'Kidato / mwaka'}</span><input required value={formOrYear} onChange={(e)=>setFormOrYear(e.target.value)} maxLength={30} className={inputClass} placeholder={level==='O_LEVEL'?'Mf. Form 4':level==='A_LEVEL'?'Mf. Form 6':'Mf. Year 2'}/></label>{level==='A_LEVEL'&&<label className="block"><span className={labelClass}>Combination</span><input value={combination} onChange={(e)=>setCombination(e.target.value)} maxLength={30} className={inputClass} placeholder="Mfano: PCM"/></label>}{level==='UNIVERSITY'&&<label className="block"><span className={labelClass}>Kozi / Programme</span><input required value={course} onChange={(e)=>setCourse(e.target.value)} maxLength={150} className={inputClass} placeholder="Mfano: Computer Science"/></label>}</div>}<div className="flex gap-2"><button type="button" onClick={()=>setStep(1)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"><ArrowLeft className="mr-1 inline h-4 w-4"/>Rudi</button><button type="button" disabled={!level} onClick={()=>{setError('');setStep(3)}} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">Endelea <ArrowRight className="ml-1 inline h-4 w-4"/></button></div></div>}
      {step === 3 && <div className="anim-slide-left space-y-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><School className="h-5 w-5" /></span><div><h2 className="font-extrabold text-slate-950 dark:text-white">Taasisi na masomo</h2><p className="text-xs text-slate-500">Taarifa hizi zinaweza kujazwa au kubadilishwa baadaye.</p></div></div>{level !== 'UNIVERSITY' ? <InstitutionSearchField kind="school" label={level === 'A_LEVEL' ? 'Tafuta high school / sekondari (hiari)' : 'Tafuta shule ya sekondari (hiari)'} value={schoolId} onChange={setSchoolId} placeholder="Andika jina la shule kutafuta kwenye orodha nzima..." /> : <InstitutionSearchField kind="tertiary" label="Tafuta college / chuo kikuu (hiari)" value={universityId} onChange={setUniversityId} placeholder="Andika jina la chuo kutafuta kwenye orodha nzima..." />}
        <div><div className="mb-2 flex items-center justify-between gap-3"><span className={labelClass}>Masomo yako</span><span className="text-xs text-slate-500">{selectedSubjects.length} yamechaguliwa</span></div>{loadingReferences ? <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-800">Inapakia masomo…</p> : levelSubjects.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{levelSubjects.map(subject=><label key={subject.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${selectedSubjects.includes(subject.id)?'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200':'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200'}`}><input type="checkbox" checked={selectedSubjects.includes(subject.id)} onChange={(e)=>setSelectedSubjects(old=>e.target.checked?[...old,subject.id]:old.filter(id=>id!==subject.id))} className="accent-emerald-600"/>{subject.name}</label>)}</div> : <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Hakuna masomo ya kiwango hiki kwenye database bado. Admin anahitaji kuongeza subjects kwanza.</p>}</div>
        <label className="block"><span className={labelClass}>Referral code (hiari)</span><input value={referralCode} onChange={(e)=>setReferralCode(e.target.value.toUpperCase())} maxLength={20} className={inputClass} placeholder="Weka code ya rafiki ikiwa unayo"/></label>
        <div className="flex gap-2"><button type="button" onClick={()=>setStep(2)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"><ArrowLeft className="mr-1 inline h-4 w-4"/>Rudi</button><button type="submit" disabled={submitting || loadingReferences || !isLevelInfoValid} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">{submitting?<><Loader2 className="mr-2 inline h-4 w-4 animate-spin"/>Inahifadhi…</>:<>Kamilisha <Check className="ml-1 inline h-4 w-4"/></>}</button></div></div>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</p>}
      <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Taarifa zako za kitaaluma zitahifadhiwa kwenye profile yako; hazitaonekana hadharani zaidi ya ruhusa zako za faragha.</p>
    </form>
  </div>
}
