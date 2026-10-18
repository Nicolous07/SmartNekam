'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, ShieldCheck, Send, UserCog } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type ProfileStatus = 'active' | 'suspended' | 'banned'
type ProfileRole = 'student' | 'mentor' | 'teacher' | 'school_admin' | 'parent' | 'moderator' | 'super_admin'

function ActionFeedback({ error, success }: { error: string; success: string }) {
  if (!error && !success) return null
  return <p role={error ? 'alert' : 'status'} className={`mt-2 text-xs font-semibold ${error ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{error || success}</p>
}

export function AdminProfileActions({ userId, role, status, canManageRoles }: { userId: string; role: string; status: string; canManageRoles: boolean }) {
  const supabase = createClient()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [newRole, setNewRole] = useState<ProfileRole>(role as ProfileRole)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function setStatus(nextStatus: ProfileStatus) {
    const reason = window.prompt(`Sababu ya kubadilisha status kuwa ${nextStatus}:`)?.trim()
    if (!reason) return
    if (!window.confirm(`Una uhakika unataka kubadilisha status ya mtumiaji kuwa ${nextStatus}?`)) return
    setBusy(true); setError(''); setSuccess('')
    const { error: rpcError } = await supabase.rpc('admin_set_profile_status', { p_user_id: userId, p_new_status: nextStatus, p_reason: reason })
    if (rpcError) setError(rpcError.message)
    else { setSuccess(`Status imebadilishwa kuwa ${nextStatus}.`); router.refresh() }
    setBusy(false)
  }

  async function saveRole() {
    if (!canManageRoles) return
    const reason = window.prompt(`Sababu ya kubadilisha role kutoka ${role} kwenda ${newRole}:`)?.trim()
    if (!reason) return
    if (!window.confirm(`Hakikisha: mpe mtumiaji role ya ${newRole}?`)) return
    setBusy(true); setError(''); setSuccess('')
    const { error: rpcError } = await supabase.rpc('admin_set_profile_role', { p_user_id: userId, p_new_role: newRole, p_reason: reason })
    if (rpcError) setError(rpcError.message)
    else { setSuccess('Role imehifadhiwa.'); router.refresh() }
    setBusy(false)
  }

  return <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
    <div className="flex flex-wrap items-center gap-2">
      {status === 'active' ? <button type="button" disabled={busy} onClick={() => void setStatus('suspended')} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-50">Sitisha</button> : <button type="button" disabled={busy} onClick={() => void setStatus('active')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Rejesha active</button>}
      {status !== 'banned' && <button type="button" disabled={busy} onClick={() => void setStatus('banned')} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Ban</button>}
      {canManageRoles && <><select aria-label="Chagua role" value={newRole} onChange={(e) => setNewRole(e.target.value as ProfileRole)} disabled={busy} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="student">student</option><option value="mentor">mentor</option><option value="teacher">teacher</option><option value="school_admin">school_admin</option><option value="parent">parent</option><option value="moderator">moderator</option><option value="super_admin">super_admin</option></select><button type="button" onClick={() => void saveRole()} disabled={busy || newRole === role} className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-40"><UserCog className="mr-1 inline h-3.5 w-3.5"/>Hifadhi role</button></>}
      {busy && <Loader2 className="h-4 w-4 animate-spin text-emerald-600"/>}
    </div>
    <ActionFeedback error={error} success={success}/>
  </div>
}

export function ReviewMentorActions({ mentorId, status }: { mentorId: string; status: string }) {
  const supabase = createClient(); const router = useRouter()
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('')
  async function review(decision: 'approve' | 'reject' | 'suspend' | 'deactivate') {
    const confirmText = decision === 'approve' ? 'Kuidhinisha mentor huyu?' : `Una uhakika wa kufanya ${decision} kwa mentor huyu?`
    if (!window.confirm(confirmText)) return
    setBusy(true); setError(''); setSuccess('')
    const { error: rpcError } = await supabase.rpc('review_mentor_profile', { p_mentor_id: mentorId, p_decision: decision })
    if (rpcError) setError(rpcError.message)
    else { setSuccess(`Kitendo ${decision} kimefanikiwa.`); router.refresh() }
    setBusy(false)
  }
  if (!['pending_review', 'active'].includes(status)) return <span className="text-xs text-slate-500">Hakuna transition ya status inayoruhusiwa kwa hali ya {status}.</span>
  return <div className="space-y-2"><div className="flex flex-wrap gap-2">{status === 'pending_review' && <><button type="button" disabled={busy} onClick={() => void review('approve')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Check className="mr-1 inline h-3.5 w-3.5"/>Approve</button><button type="button" disabled={busy} onClick={() => void review('reject')} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Reject</button></>}{status === 'active' && <button type="button" disabled={busy} onClick={() => void review('suspend')} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Suspend</button>}{busy && <Loader2 className="h-4 w-4 animate-spin"/>}</div><ActionFeedback error={error} success={success}/></div>
}

export function ReviewCourseActions({ courseId }: { courseId: string }) {
  const supabase = createClient(); const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('')
  async function review(decision: 'approve' | 'reject') {
    const note = decision === 'reject' ? window.prompt('Sababu/maelezo ya review:')?.trim() : (window.prompt('Maelezo ya review (hiari):') ?? '')
    if (decision === 'reject' && !note) return
    if (!window.confirm(`${decision === 'approve' ? 'Chapisha' : 'Kataa'} kozi hii?`)) return
    setBusy(true); setError(''); setSuccess('')
    const { error: rpcError } = await supabase.rpc('review_course', { p_course_id: courseId, p_decision: decision, p_note: note || null })
    if (rpcError) setError(rpcError.message); else { setSuccess('Review imehifadhiwa.'); router.refresh() }
    setBusy(false)
  }
  return <div className="space-y-2"><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void review('approve')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Publish</button><button type="button" disabled={busy} onClick={() => void review('reject')} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Reject</button>{busy && <Loader2 className="h-4 w-4 animate-spin"/>}</div><ActionFeedback error={error} success={success}/></div>
}

export function ReviewFlashcardActions({ deckId }: { deckId: string }) {
  const supabase = createClient(); const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('')
  async function review(decision: 'approve' | 'reject') {
    const note = decision === 'reject' ? window.prompt('Sababu ya kukataa:')?.trim() : (window.prompt('Maelezo ya review (hiari):') ?? '')
    if (decision === 'reject' && !note) return
    setBusy(true); setError(''); setSuccess('')
    const { error: rpcError } = await supabase.rpc('review_flashcard_deck', { p_deck_id: deckId, p_decision: decision, p_note: note || null })
    if (rpcError) setError(rpcError.message); else { setSuccess('Flashcard deck imehakikiwa.'); router.refresh() }
    setBusy(false)
  }
  return <div className="space-y-2"><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void review('approve')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Approve</button><button type="button" disabled={busy} onClick={() => void review('reject')} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Reject</button>{busy && <Loader2 className="h-4 w-4 animate-spin"/>}</div><ActionFeedback error={error} success={success}/></div>
}

export function SupportTicketActions({ ticketId, status, priority }: { ticketId: string; status: string; priority: string }) {
  const supabase = createClient(); const router = useRouter(); const [nextStatus, setNextStatus] = useState(status); const [nextPriority, setNextPriority] = useState(priority); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('')
  async function save() {
    setBusy(true); setError(''); setSuccess('')
    const { error: rpcError } = await supabase.rpc('admin_update_support_ticket', { p_ticket_id: ticketId, p_status: nextStatus, p_priority: nextPriority, p_assigned_to: null })
    if (rpcError) setError(rpcError.message); else { setSuccess('Tiketi imesasishwa.'); router.refresh() }
    setBusy(false)
  }
  return <div className="space-y-2"><div className="flex flex-wrap gap-2"><select aria-label="Ticket status" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"><option value="open">open</option><option value="in_progress">in_progress</option><option value="waiting_for_user">waiting_for_user</option><option value="resolved">resolved</option><option value="closed">closed</option></select><select aria-label="Ticket priority" value={nextPriority} onChange={(e) => setNextPriority(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"><option value="low">low</option><option value="normal">normal</option><option value="high">high</option><option value="urgent">urgent</option></select><button type="button" disabled={busy || (nextStatus === status && nextPriority === priority)} onClick={() => void save()} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="inline h-3.5 w-3.5 animate-spin"/> : 'Hifadhi'}</button></div><ActionFeedback error={error} success={success}/></div>
}

export function ReferralActions({ referralId }: { referralId: string }) {
  const supabase = createClient(); const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('')
  async function decide(decision: 'reward' | 'reject') {
    const xp = decision === 'reward' ? Number(window.prompt('XP zitakazotolewa kwa referrer na mwanafunzi:', '25') || '0') : 0
    if (decision === 'reward' && (!Number.isInteger(xp) || xp < 1 || xp > 1000)) { setError('XP lazima iwe namba nzima kati ya 1 na 1000.'); return }
    const reason = decision === 'reject' ? window.prompt('Sababu ya kukataa referral:')?.trim() : null
    if (decision === 'reject' && !reason) return
    if (!window.confirm(decision === 'reward' ? `Toa ${xp} XP kwa pande zote mbili?` : 'Kataa referral hii?')) return
    setBusy(true); setError(''); setSuccess('')
    const { error: rpcError } = await supabase.rpc('review_referral_event', { p_referral_event_id: referralId, p_decision: decision, p_reward_xp: xp || 25, p_rejection_reason: reason })
    if (rpcError) setError(rpcError.message); else { setSuccess('Referral imehakikiwa.'); router.refresh() }
    setBusy(false)
  }
  return <div className="space-y-2"><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void decide('reward')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Thibitisha & toa XP</button><button type="button" disabled={busy} onClick={() => void decide('reject')} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Kataa</button>{busy && <Loader2 className="h-4 w-4 animate-spin"/>}</div><ActionFeedback error={error} success={success}/></div>
}

type NotificationRecipient = { id: string; full_name: string; email: string | null }
type NotificationTargetMode = 'one' | 'selected' | 'all'

export function AdminNotificationComposer({ recipients }: { recipients: NotificationRecipient[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [targetMode, setTargetMode] = useState<NotificationTargetMode>('one')
  const [userId, setUserId] = useState(recipients[0]?.id ?? '')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [recipientSearch, setRecipientSearch] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState('announcement')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const filteredRecipients = recipients.filter((person) => {
    const query = recipientSearch.trim().toLocaleLowerCase()
    return !query || `${person.full_name} ${person.email ?? ''}`.toLocaleLowerCase().includes(query)
  })

  function toggleRecipient(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }

  function toggleVisibleRecipients(checked: boolean) {
    const visibleIds = filteredRecipients.map((person) => person.id)
    setSelectedIds((current) => checked
      ? [...new Set([...current, ...visibleIds])]
      : current.filter((id) => !visibleIds.includes(id)))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!title.trim()) { setError('Kichwa cha notification kinahitajika.'); return }
    if (targetMode === 'one' && !userId) { setError('Chagua akaunti moja ya kupokea taarifa.'); return }
    if (targetMode === 'selected' && selectedIds.length === 0) { setError('Chagua angalau mtumiaji mmoja kwenye orodha.'); return }

    const targetLabel = targetMode === 'all' ? 'watumiaji wote wenye akaunti active' : targetMode === 'one' ? 'akaunti moja uliyochagua' : `${selectedIds.length} watumiaji uliowachagua`
    if (!window.confirm(`Tuma notification hii kwa ${targetLabel}? Hatua hii itaunda taarifa kwa kila mpokeaji.`)) return

    setBusy(true)
    const { data, error: rpcError } = await supabase.rpc('admin_create_notifications', {
      p_target_mode: targetMode,
      p_user_ids: targetMode === 'one' ? [userId] : targetMode === 'selected' ? selectedIds : [],
      p_title: title.trim(),
      p_body: body.trim(),
      p_notification_type: type,
      p_data: {},
    })

    if (rpcError) {
      setError(`${rpcError.message}${rpcError.message.includes('admin_create_notifications') ? ' — Hakikisha umeendesha SQL 033.' : ''}`)
    } else {
      const count = typeof data === 'number' ? data : Number(data ?? 0)
      setSuccess(`Notification imetumwa ndani ya app kwa akaunti ${count || (targetMode === 'one' ? 1 : targetMode === 'selected' ? selectedIds.length : 'zote')} zilizolengwa. Push za kifaa zitatumwa kwa vifaa vilivyosajiliwa na kuruhusiwa.`)
      setTitle('')
      setBody('')
      if (targetMode === 'selected') setSelectedIds([])
      router.refresh()
    }
    setBusy(false)
  }

  return <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-2xl border border-emerald-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
    <div>
      <h3 className="font-extrabold text-slate-950 dark:text-white">Tuma notification kwa watumiaji</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">Ujumbe utaonekana kwenye taarifa za ndani ya app. Vifaa vilivyosajiliwa na kuruhusu push pia vitapokea arifa ya simu/PC.</p>
    </div>

    <fieldset className="space-y-2">
      <legend className="mb-2 text-xs font-bold text-slate-600 dark:text-slate-300">Walengwa</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${targetMode === 'one' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-800'}`}>
          <input type="radio" name="notification-target-mode" checked={targetMode === 'one'} onChange={() => setTargetMode('one')} className="mt-0.5 accent-emerald-600" />
          <span><span className="block font-extrabold">Mtu mmoja</span><span className="mt-0.5 block text-xs text-slate-500">Akaunti moja</span></span>
        </label>
        <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${targetMode === 'selected' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-800'}`}>
          <input type="radio" name="notification-target-mode" checked={targetMode === 'selected'} onChange={() => setTargetMode('selected')} className="mt-0.5 accent-emerald-600" />
          <span><span className="block font-extrabold">Chagua wengi</span><span className="mt-0.5 block text-xs text-slate-500">Select watumiaji</span></span>
        </label>
        <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${targetMode === 'all' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-800'}`}>
          <input type="radio" name="notification-target-mode" checked={targetMode === 'all'} onChange={() => setTargetMode('all')} className="mt-0.5 accent-emerald-600" />
          <span><span className="block font-extrabold">Wote</span><span className="mt-0.5 block text-xs text-slate-500">Akaunti active zote</span></span>
        </label>
      </div>
    </fieldset>

    {targetMode === 'one' && <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Mpokeaji
      <select required value={userId} onChange={(event) => setUserId(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" disabled={!recipients.length}>
        <option value="">Chagua mtumiaji</option>
        {recipients.map((person) => <option key={person.id} value={person.id}>{person.full_name}{person.email ? ` · ${person.email}` : ''}</option>)}
      </select>
    </label>}

    {targetMode === 'selected' && <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Tafuta kwenye orodha ya akaunti active
        <input value={recipientSearch} onChange={(event) => setRecipientSearch(event.target.value)} placeholder="Jina au email…" className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-extrabold text-emerald-700 dark:text-emerald-300">{selectedIds.length} wamechaguliwa</span>
        <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={filteredRecipients.length > 0 && filteredRecipients.every((person) => selectedIds.includes(person.id))} onChange={(event) => toggleVisibleRecipients(event.target.checked)} className="accent-emerald-600" />Chagua wote wanaoonekana</label>
      </div>
      <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
        {filteredRecipients.map((person) => <label key={person.id} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-900">
          <input type="checkbox" checked={selectedIds.includes(person.id)} onChange={() => toggleRecipient(person.id)} className="mt-1 accent-emerald-600" />
          <span className="min-w-0"><span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{person.full_name || 'Mtumiaji'}</span>{person.email && <span className="block break-all text-xs text-slate-500">{person.email}</span>}</span>
        </label>)}
        {!filteredRecipients.length && <p className="p-3 text-xs text-slate-500">Hakuna akaunti iliyolingana na utafutaji huo.</p>}
      </div>
    </div>}

    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Aina ya taarifa
        <select value={type} onChange={(event) => setType(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
          <option value="announcement">Tangazo</option><option value="system">Mfumo</option><option value="security">Usalama</option><option value="deadline">Deadline</option><option value="community">Jamii</option><option value="application">Maombi</option><option value="mentor">Mentorship</option>
        </select>
      </label>
      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Kichwa<input required maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Mf. Kuna fursa mpya" className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
    </div>
    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Ujumbe<textarea rows={3} maxLength={5000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Andika maelezo ya taarifa…" className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
    <button type="submit" disabled={busy || (targetMode === 'one' && (!recipients.length || !userId)) || (targetMode === 'selected' && selectedIds.length === 0)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">{busy ? <Loader2 className="inline h-4 w-4 animate-spin" /> : <><Send className="mr-2 inline h-4 w-4" />Tuma notification</>}</button>
    <ActionFeedback error={error} success={success} />
  </form>
}

export function OpportunityLifecycleActions({ opportunityId, status }: { opportunityId: string; status: string }) {
  const supabase = createClient(); const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('')
  async function update(decision: 'approve' | 'reject' | 'remove') {
    const promptLabel = decision === 'remove' ? 'Sababu ya kufunga fursa hii:' : decision === 'reject' ? 'Sababu ya kukataa fursa hii:' : 'Maelezo ya uthibitisho (hiari):'
    const promptResult = window.prompt(promptLabel, '')
    if (promptResult === null) return
    const reason = promptResult.trim()
    if ((decision === 'remove' || decision === 'reject') && reason.length < 3) { setError('Sababu ya kufunga/kukataa fursa lazima iwe na angalau herufi 3.'); return }
    const confirmLabel = decision === 'remove' ? 'Funga fursa hii? Haitasalia active.' : decision === 'reject' ? 'Kataa fursa hii?' : status === 'closed' ? 'Fungua tena na thibitisha fursa hii?' : 'Chapisha na thibitisha fursa hii?'
    if (!window.confirm(confirmLabel)) return
    setBusy(true); setError(''); setSuccess('')
    const { error: rpcError } = await supabase.rpc('review_library_content', { p_content_type: 'opportunity', p_content_id: opportunityId, p_decision: decision, p_reason: reason || null })
    if (rpcError) setError(rpcError.message); else { setSuccess(decision === 'remove' ? 'Fursa imefungwa.' : decision === 'reject' ? 'Fursa imekataliwa.' : status === 'closed' ? 'Fursa imefunguliwa tena na kuwekwa verified.' : 'Fursa imechapishwa na kuwekwa verified.'); router.refresh() }
    setBusy(false)
  }
  if (status === 'active') return <div className="space-y-2"><button type="button" disabled={busy} onClick={() => void update('remove')} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-50">{busy ? <Loader2 className="inline h-3.5 w-3.5 animate-spin"/> : 'Funga fursa'}</button><ActionFeedback error={error} success={success}/></div>
  if (status === 'closed') return <div className="space-y-2"><button type="button" disabled={busy} onClick={() => void update('approve')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="inline h-3.5 w-3.5 animate-spin"/> : 'Fungua tena & verify'}</button><ActionFeedback error={error} success={success}/></div>
  if (status === 'draft' || status === 'rejected') return <div className="space-y-2"><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void update('approve')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="inline h-3.5 w-3.5 animate-spin"/> : 'Publish & verify'}</button><button type="button" disabled={busy} onClick={() => void update('reject')} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Reject</button></div><ActionFeedback error={error} success={success}/></div>
  return <span className="text-xs text-slate-500">Hakuna transition ya fursa inayoruhusiwa kwa hali ya {status}.</span>
}
