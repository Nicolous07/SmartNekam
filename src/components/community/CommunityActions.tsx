'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, CircleHelp, ImagePlus, Loader2, Plus, Users, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Subject = { id: string; name: string; level: string }

export function CommunityActions({ subjects, initialCreate = '', institutionScope }: { subjects: Subject[]; initialCreate?: string; institutionScope?: { kind: 'school' | 'tertiary'; id: string; name: string } }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [mode, setMode] = useState<'group' | 'question' | null>(initialCreate === 'question' ? 'question' : initialCreate === 'group' ? 'group' : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [groupLevel, setGroupLevel] = useState(institutionScope?.kind === 'tertiary' ? 'UNIVERSITY' : 'O_LEVEL')
  const [groupSubject, setGroupSubject] = useState('')
  const [privacy, setPrivacy] = useState('public')
  const [questionTitle, setQuestionTitle] = useState('')
  const [questionBody, setQuestionBody] = useState('')
  const [questionSubject, setQuestionSubject] = useState('')
  const [questionImage, setQuestionImage] = useState<File | null>(null)

  async function createGroup(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Ingia tena ili kutengeneza kikundi.')
      const scopedFields = institutionScope ? (institutionScope.kind === 'school' ? { school_id: institutionScope.id, university_id: null } : { school_id: null, university_id: institutionScope.id }) : { school_id: null, university_id: null }
      const { error: insertError } = await supabase.from('study_groups').insert({ name: groupName.trim(), description: groupDescription.trim(), level: groupLevel, subject_id: groupSubject || null, privacy, ...scopedFields })
      if (insertError) throw insertError
      setNotice(institutionScope ? `Kikundi kimeundwa kwa ${institutionScope.name}; kitaonekana kwa wanafunzi wa taasisi hii pekee.` : 'Kikundi kimeundwa. Sasa unaweza kukishiriki na wanafunzi wengine.')
      setGroupName(''); setGroupDescription(''); setMode(null); router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Imeshindikana kutengeneza kikundi.') }
    finally { setBusy(false) }
  }
  async function createQuestion(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Ingia tena ili kuuliza swali.')
      if (!questionSubject) throw new Error('Chagua somo la swali.')
      if (questionImage && !questionImage.type.startsWith('image/')) throw new Error('Kwa scan ya swali, chagua picha kutoka kwenye kamera.')
      if (questionImage && questionImage.size > 10 * 1024 * 1024) throw new Error('Picha ya swali iwe chini ya 10 MB.')
      const scopedFields = institutionScope ? (institutionScope.kind === 'school' ? { school_id: institutionScope.id, university_id: null } : { school_id: null, university_id: institutionScope.id }) : { school_id: null, university_id: null }
      const { data: question, error: insertError } = await supabase.from('questions').insert({ user_id: user.id, subject_id: questionSubject, title: questionTitle.trim() || null, body: questionBody.trim(), ...scopedFields }).select('id').single()
      if (insertError) throw insertError
      if (!question) throw new Error('Swali halikupata utambulisho wa kuhifadhi kiambatisho.')
      if (questionImage) {
        const safeName = questionImage.name.replace(/[^a-zA-Z0-9._-]+/g, '_') || `scan-${Date.now()}.jpg`
        const path = `${user.id}/questions/${question.id}/${Date.now()}-${safeName}`
        const { error: uploadError } = await supabase.storage.from('community-attachments').upload(path, questionImage, { contentType: questionImage.type || 'image/jpeg', upsert: false })
        if (uploadError) {
          await supabase.from('questions').delete().eq('id', question.id)
          throw new Error(`Swali halikutumwa kwa sababu picha haikupakiwa: ${uploadError.message}`)
        }
        const { error: attachmentError } = await supabase.from('questions').update({ attachments: [path] }).eq('id', question.id).eq('user_id', user.id)
        if (attachmentError) {
          await supabase.storage.from('community-attachments').remove([path])
          await supabase.from('questions').delete().eq('id', question.id)
          throw new Error(`Imeshindikana kuunganisha picha na swali: ${attachmentError.message}`)
        }
      }
      setNotice(institutionScope ? `Swali limetumwa kwenye maswali ya ${institutionScope.name}; halitaonekana kwenye Q&A ya wote.` : 'Swali lako limetumwa kwenye Q&A ya wazi kwa wanafunzi wote.')
      setQuestionTitle(''); setQuestionBody(''); setQuestionImage(null); setMode(null); router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Imeshindikana kutuma swali.') }
    finally { setBusy(false) }
  }

  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setMode(mode === 'group' ? null : 'group'); setError('') }} className="inline-flex items-center gap-2 rounded-xl sn-primary-gradient px-3 py-2.5 text-sm font-extrabold text-white"><Users className="h-4 w-4" /> {institutionScope ? 'Tengeneza group la taasisi' : 'Tengeneza group'}</button><button type="button" onClick={() => { setMode(mode === 'question' ? null : 'question'); setError('') }} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 px-3 py-2.5 text-sm font-extrabold text-indigo-800 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-200 dark:hover:bg-slate-800"><CircleHelp className="h-4 w-4" /> {institutionScope ? 'Uliza swali la taasisi' : 'Uliza swali'}</button></div>
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">{notice}</p>}
    {mode && <section className="geometric-card anim-fade-up p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-heading text-lg font-extrabold text-slate-950 dark:text-white">{mode === 'group' ? (institutionScope ? `Tengeneza group la ${institutionScope.name}` : 'Tengeneza study group') : (institutionScope ? `Uliza swali la ${institutionScope.name}` : 'Uliza swali la kitaaluma')}</h2><button type="button" onClick={() => setMode(null)} aria-label="Funga fomu" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
      {mode === 'group' ? <form onSubmit={createGroup} className="space-y-3"><div><label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Jina la group</label><input required maxLength={150} value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Mfano: Form Four Biology 2026" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></div><div><label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Maelezo</label><textarea value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} rows={2} maxLength={2000} placeholder="Madhumuni ya kikundi..." className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></div><div className="grid gap-3 sm:grid-cols-3"><div><label className="mb-1 block text-xs font-bold">Level</label><select value={groupLevel} onChange={(e) => setGroupLevel(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="O_LEVEL">O-Level</option><option value="A_LEVEL">A-Level</option><option value="UNIVERSITY">University</option></select></div><div><label className="mb-1 block text-xs font-bold">Somo (hiari)</label><select value={groupSubject} onChange={(e) => setGroupSubject(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="">Bila somo maalum</option>{subjects.filter((s) => s.level === groupLevel).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div><label className="mb-1 block text-xs font-bold">Faragha</label><select value={privacy} onChange={(e) => setPrivacy(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="public">Public</option><option value="private">Private / invite only</option></select></div></div><button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Unda kikundi</button></form> : <form onSubmit={createQuestion} className="space-y-3"><div><label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Somo</label><select required value={questionSubject} onChange={(e) => setQuestionSubject(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="">Chagua somo</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.level.replace('_', '-')}</option>)}</select></div><div><label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Kichwa (hiari)</label><input value={questionTitle} onChange={(e) => setQuestionTitle(e.target.value)} maxLength={200} placeholder="Swali lako kwa ufupi" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></div><div><label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Maelezo ya swali</label><textarea required value={questionBody} onChange={(e) => setQuestionBody(e.target.value)} rows={4} maxLength={12000} placeholder="Eleza swali kwa ufasaha. Unaweza kuweka hatua ulizojaribu..." className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></div><div className="flex flex-wrap items-center gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2.5 text-xs font-extrabold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-200 dark:hover:bg-slate-800"><Camera className="h-4 w-4" /> Piga/scan swali kwa kamera<input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.currentTarget.files?.[0] ?? null; setQuestionImage(file); event.currentTarget.value = '' }} /></label>{questionImage && <span className="inline-flex min-w-0 items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"><ImagePlus className="h-4 w-4 shrink-0" /><span className="max-w-[200px] truncate">{questionImage.name}</span><button type="button" aria-label="Ondoa picha ya swali" onClick={() => setQuestionImage(null)} className="rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700"><X className="h-3.5 w-3.5" /></button></span>}</div><p className="text-[11px] text-slate-500 dark:text-slate-400">Picha itapakiwa pamoja na swali. Kwenye simu, button hii hufungua kamera inapoungwa mkono.</p><button disabled={busy || subjects.length === 0} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleHelp className="h-4 w-4" />} Tuma swali</button></form>}
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200">{error}</p>}
    </section>}
  </div>
}

export function JoinGroupButton({ groupId, inviteRequired = false }: { groupId: string; inviteRequired?: boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function join() {
    setBusy(true); setMessage('')
    try {
      let inviteCode: string | null = null
      if (inviteRequired) { inviteCode = window.prompt('Ingiza invite code ya kikundi:')?.trim() ?? null; if (!inviteCode) return }
      const { error } = await supabase.rpc('join_study_group', { p_group_id: groupId, p_invite_code: inviteCode })
      if (error) throw error
      setMessage('Umejiunga!'); router.refresh()
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Imeshindikana kujiunga.') }
    finally { setBusy(false) }
  }
  return <div className="text-right"><button type="button" onClick={join} disabled={busy} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-emerald-500 disabled:opacity-60">{busy ? 'Inaunganisha...' : 'Jiunge'}</button>{message && <p className="mt-1 max-w-32 text-[10px] text-slate-500">{message}</p>}</div>
}
