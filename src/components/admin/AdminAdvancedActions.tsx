'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type SchoolOption = { id: string; name: string }

function Feedback({ error, success }: { error: string; success: string }) {
  if (!error && !success) return null
  return <p role={error ? 'alert' : 'status'} className={`text-xs font-semibold ${error ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{error || success}</p>
}

export function CommunityModerationActions({ itemId, kind, status }: { itemId: string; kind: 'group' | 'question' | 'event'; status: string }) {
  const supabase = createClient(); const router = useRouter()
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('')
  const decisions = kind === 'group'
    ? (status === 'active' ? [{ value: 'archive', label: 'Archive' }, { value: 'remove', label: 'Remove' }] : status === 'archived' || status === 'removed' ? [{ value: 'activate', label: 'Activate' }] : [{ value: 'archive', label: 'Archive' }, { value: 'remove', label: 'Remove' }])
    : kind === 'question'
      ? (status === 'removed' ? [{ value: 'reopen', label: 'Reopen' }] : [{ value: 'reopen', label: 'Reopen' }, { value: 'resolve', label: 'Resolve' }, { value: 'close', label: 'Close' }, { value: 'remove', label: 'Remove' }])
      : (status === 'pending_review' ? [{ value: 'approve', label: 'Approve' }, { value: 'reject', label: 'Reject' }] : status === 'active' ? [{ value: 'cancel', label: 'Cancel' }, { value: 'complete', label: 'Mark completed' }] : [])

  async function act(decision: string) {
    const reason = window.prompt('Andika sababu/maelezo ya moderation:')?.trim() ?? ''
    if ((decision === 'remove' || decision === 'reject') && reason.length < 3) { setError('Sababu ya kuondoa/kukataa lazima iwe na angalau herufi 3.'); return }
    if (!window.confirm(`Thibitisha kitendo: ${decision}?`)) return
    setBusy(true); setError(''); setSuccess('')
    const result = kind === 'group'
      ? await supabase.rpc('admin_moderate_study_group', { p_group_id: itemId, p_decision: decision, p_reason: reason || null })
      : kind === 'question'
        ? await supabase.rpc('admin_moderate_question', { p_question_id: itemId, p_decision: decision, p_reason: reason || null })
        : await supabase.rpc('review_community_event', { p_event_id: itemId, p_decision: decision })
    const rpcError = result.error
    if (rpcError) setError(rpcError.message)
    else { setSuccess('Kitendo kimehifadhiwa.'); router.refresh() }
    setBusy(false)
  }
  return <div className="space-y-2"><div className="flex flex-wrap gap-2">{decisions.map((decision) => <button key={decision.value} type="button" disabled={busy} onClick={() => void act(decision.value)} className={`rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50 ${decision.value === 'remove' || decision.value === 'reject' || decision.value === 'cancel' ? 'border border-red-300 text-red-700 dark:text-red-300' : 'bg-emerald-600 text-white'}`}>{decision.label}</button>)}{busy && <Loader2 className="h-4 w-4 animate-spin"/>}</div><Feedback error={error} success={success}/></div>
}

export function CertificateRevokeAction({ certificateId, status }: { certificateId: string; status: string }) {
  const supabase = createClient(); const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('')
  async function revoke() {
    const reason = window.prompt('Sababu rasmi ya kufuta/ku-revoke cheti:')?.trim() ?? ''
    if (reason.length < 3) { setError('Sababu lazima iwe na angalau herufi 3.'); return }
    if (!window.confirm('Cheti kitawekwa revoked na verification yake itaonyesha hali hiyo. Endelea?')) return
    setBusy(true); setError(''); setSuccess('')
    const { error: rpcError } = await supabase.rpc('admin_revoke_certificate', { p_certificate_id: certificateId, p_reason: reason })
    if (rpcError) setError(rpcError.message); else { setSuccess('Cheti kimewekwa revoked.'); router.refresh() }
    setBusy(false)
  }
  if (status !== 'active') return <span className="text-xs text-slate-500">Hakuna kitendo kwa cheti kilicho revoked.</span>
  return <div className="space-y-1"><button type="button" disabled={busy} onClick={() => void revoke()} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">{busy ? <Loader2 className="inline h-3.5 w-3.5 animate-spin"/> : 'Revoke certificate'}</button><Feedback error={error} success={success}/></div>
}

export function AccountDataRequestActions({ requestId }: { requestId: string }) {
  const supabase = createClient(); const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('')
  async function decide(decision: 'processing' | 'completed' | 'rejected') {
    const note = window.prompt('Andika hatua iliyofanyika au sababu ya uamuzi:')?.trim() ?? ''
    if (!note) { setError('Maelezo ya uamuzi yanahitajika.'); return }
    if (decision === 'completed' && !window.confirm('Tunahakikisha export/deletion yenyewe tayari imekamilika nje ya panel?')) return
    setBusy(true); setError(''); setSuccess('')
    const { error: rpcError } = await supabase.rpc('admin_review_account_data_request', { p_request_id: requestId, p_decision: decision, p_admin_note: note })
    if (rpcError) setError(rpcError.message); else { setSuccess('Hali ya ombi imesasishwa. Kumbuka: kubadili status hakutekelezi export au deletion ya faili yenyewe.'); router.refresh() }
    setBusy(false)
  }
  return <div className="space-y-2"><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void decide('processing')} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-50">Weka processing</button><button type="button" disabled={busy} onClick={() => void decide('rejected')} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Kataa</button><button type="button" disabled={busy} onClick={() => void decide('completed')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Weka completed</button></div><Feedback error={error} success={success}/></div>
}

export function InstitutionCreateForm() {
  const supabase = createClient(); const router = useRouter(); const [kind, setKind] = useState<'school' | 'university'>('school'); const [name, setName] = useState(''); const [region, setRegion] = useState(''); const [district, setDistrict] = useState(''); const [country, setCountry] = useState('Tanzania'); const [website, setWebsite] = useState(''); const [admissionsUrl, setAdmissionsUrl] = useState(''); const [schoolType, setSchoolType] = useState('secondary'); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('')
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setSuccess('')
    if (name.trim().length < 2) { setError('Jina la taasisi ni fupi sana.'); return }
    setBusy(true)
    const { data, error: rpcError } = await supabase.rpc('admin_create_institution', { p_kind: kind, p_name: name.trim(), p_region: region.trim() || null, p_country: country.trim(), p_website: website.trim() || null, p_district: kind === 'school' ? district.trim() || null : null, p_school_type: kind === 'school' ? schoolType : null, p_admissions_url: kind === 'university' ? admissionsUrl.trim() || null : null })
    if (rpcError) setError(rpcError.message); else { setSuccess(`Taasisi imeongezwa. ID: ${data}`); setName(''); setRegion(''); setDistrict(''); setWebsite(''); setAdmissionsUrl(''); router.refresh() }
    setBusy(false)
  }
  return <form onSubmit={(e) => void submit(e)} className="space-y-3 rounded-2xl border border-emerald-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"><h3 className="font-extrabold text-slate-950 dark:text-white">Ongeza taasisi mpya</h3><p className="text-xs text-slate-500">Kitendo hiki kinahitaji Super Admin na kitaandikwa kwenye audit log.</p><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Aina<select value={kind} onChange={(e) => setKind(e.target.value as 'school' | 'university')} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="school">Shule</option><option value="university">Chuo kikuu</option></select></label><label className="text-xs font-bold">Jina<input required maxLength={180} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/></label><label className="text-xs font-bold">Nchi<input required maxLength={80} value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/></label><label className="text-xs font-bold">Mkoa<input maxLength={80} value={region} onChange={(e) => setRegion(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/></label>{kind === 'school' && <><label className="text-xs font-bold">Wilaya<input maxLength={100} value={district} onChange={(e) => setDistrict(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/></label><label className="text-xs font-bold">Aina ya shule<select value={schoolType} onChange={(e) => setSchoolType(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="secondary">Secondary</option><option value="primary">Primary</option><option value="technical">Technical</option><option value="other">Other</option></select></label></>}<label className="text-xs font-bold">Website URL<input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/></label>{kind === 'university' && <label className="text-xs font-bold">Admissions URL<input type="url" value={admissionsUrl} onChange={(e) => setAdmissionsUrl(e.target.value)} placeholder="https://..." className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/></label>}</div><button type="submit" disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">{busy ? <Loader2 className="inline h-4 w-4 animate-spin"/> : <><Plus className="mr-2 inline h-4 w-4"/>Ongeza taasisi</>}</button><Feedback error={error} success={success}/></form>
}

export function OpportunityCreateForm() {
  const supabase = createClient(); const router = useRouter(); const [title, setTitle] = useState(''); const [type, setType] = useState('scholarship'); const [sponsor, setSponsor] = useState(''); const [country, setCountry] = useState('Tanzania'); const [level, setLevel] = useState('ALL'); const [deadline, setDeadline] = useState(''); const [eligibility, setEligibility] = useState(''); const [source, setSource] = useState(''); const [application, setApplication] = useState(''); const [description, setDescription] = useState(''); const [field, setField] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('')
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setSuccess('')
    if (title.trim().length < 3 || !source.startsWith('http')) { setError('Jaza jina na official source URL sahihi.'); return }
    setBusy(true)
    const { data, error: rpcError } = await supabase.rpc('admin_create_opportunity', { p_title: title.trim(), p_type: type, p_sponsor: sponsor.trim() || null, p_country: country.trim(), p_level: level, p_deadline: deadline || null, p_eligibility: eligibility.trim() || null, p_source_url: source.trim(), p_application_url: application.trim() || null, p_description: description.trim() || null, p_field: field.trim() || null })
    if (rpcError) setError(rpcError.message); else { setSuccess(`Fursa imeongezwa kwenye foleni ya review. ID: ${data}`); setTitle(''); setSponsor(''); setEligibility(''); setSource(''); setApplication(''); setDescription(''); setField(''); setDeadline(''); router.refresh() }
    setBusy(false)
  }
  return <form onSubmit={(e) => void submit(e)} className="space-y-3 rounded-2xl border border-emerald-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"><h3 className="font-extrabold text-slate-950 dark:text-white">Ongeza fursa mpya</h3><p className="text-xs text-slate-500">Fursa mpya haichapishwi moja kwa moja: inaingia `pending_review` ili ithibitishwe kwanza.</p><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Jina la fursa<input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/></label><label className="text-xs font-bold">Aina<select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="scholarship">Scholarship</option><option value="competition">Competition</option><option value="internship">Internship</option><option value="job">Job</option><option value="graduate_programme">Graduate programme</option><option value="volunteering">Volunteering</option><option value="loan">Loan</option><option value="university">University</option></select></label><label className="text-xs font-bold">Sponsor<input maxLength={180} value={sponsor} onChange={(e) => setSponsor(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/></label><label className="text-xs font-bold">Nchi<input required maxLength={100} value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/></label><label className="text-xs font-bold">Kiwango<select value={level} onChange={(e) => setLevel(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="ALL">All levels</option><option value="O_LEVEL">O-Level</option><option value="A_LEVEL">A-Level</option><option value="UNIVERSITY">University</option></select></label><label className="text-xs font-bold">Deadline<input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/></label><label className="text-xs font-bold">Field<input maxLength={120} value={field} onChange={(e) => setField(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/></label><label className="text-xs font-bold">Official source URL<input required type="url" value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://official-site..." className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/></label><label className="text-xs font-bold">Application URL<input type="url" value={application} onChange={(e) => setApplication(e.target.value)} placeholder="https://..." className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/></label><label className="text-xs font-bold sm:col-span-2">Eligibility<textarea rows={2} value={eligibility} onChange={(e) => setEligibility(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/></label><label className="text-xs font-bold sm:col-span-2">Maelezo<textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/></label></div><button type="submit" disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">{busy ? <Loader2 className="inline h-4 w-4 animate-spin"/> : <><Plus className="mr-2 inline h-4 w-4"/>Hifadhi fursa</>}</button><Feedback error={error} success={success}/></form>
}

export function SchoolAnnouncementForm({ schools }: { schools: SchoolOption[] }) {
  const supabase = createClient(); const router = useRouter(); const [schoolId, setSchoolId] = useState(schools[0]?.id ?? ''); const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [audience, setAudience] = useState('school'); const [publish, setPublish] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('')
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!schoolId) { setError('Ongeza/teua shule kwanza.'); return }; if (title.trim().length < 2 || body.trim().length < 2) { setError('Kichwa na ujumbe vinahitajika.'); return }
    if (publish && !window.confirm('Tangazo litakuwa published kwa audience uliyochagua. Endelea?')) return
    setBusy(true); setError(''); setSuccess('')
    const { data, error: rpcError } = await supabase.rpc('admin_create_school_announcement', { p_school_id: schoolId, p_title: title.trim(), p_body: body.trim(), p_audience: audience, p_publish: publish })
    if (rpcError) setError(rpcError.message); else { setSuccess(`Tangazo limehifadhiwa (${publish ? 'published' : 'draft'}). ID: ${data}`); setTitle(''); setBody(''); router.refresh() }
    setBusy(false)
  }
  return <form onSubmit={(e) => void submit(e)} className="space-y-3 rounded-2xl border border-emerald-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"><h3 className="font-extrabold text-slate-950 dark:text-white">Tangazo rasmi la shule</h3><p className="text-xs text-slate-500">Linatengenezwa kwa shule moja. Kuchapisha kunahitaji uthibitisho; delivery ya email/SMS si sehemu ya RPC hii.</p><label className="block text-xs font-bold">Shule<select required value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" disabled={!schools.length}><option value="">Chagua shule</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="block text-xs font-bold">Audience<select value={audience} onChange={(e) => setAudience(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="school">School</option><option value="students">Students</option><option value="parents">Parents</option><option value="teachers">Teachers</option><option value="all">All</option></select></label><label className="block text-xs font-bold">Kichwa<input required maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/></label><label className="block text-xs font-bold">Ujumbe<textarea required rows={4} value={body} onChange={(e) => setBody(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/></label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)}/>Chapisha mara moja</label><button type="submit" disabled={busy || !schools.length} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">{busy ? <Loader2 className="inline h-4 w-4 animate-spin"/> : <><Send className="mr-2 inline h-4 w-4"/>Hifadhi tangazo</>}</button><Feedback error={error} success={success}/></form>
}
