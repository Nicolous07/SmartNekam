'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Download, FileText, Image as ImageIcon, Loader2, MessageCircle, Paperclip, RefreshCw, Send, Trash2, Users, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useDataSaver } from '@/components/data-saver/DataSaverProvider'

type Identity = { full_name: string | null; username: string | null }
type Message = { id: string; group_id: string; sender_id: string; body: string; attachment_paths: string[]; created_at: string }
type Post = { id: string; author_id: string; body: string; created_at: string }

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'M'
}

async function loadIdentities(supabase: ReturnType<typeof createClient>, ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))]
  if (!uniqueIds.length) return {} as Record<string, Identity>
  const { data } = await supabase.from('community_profiles').select('id,full_name').in('id', uniqueIds)
  return Object.fromEntries((data ?? []).map((profile) => [profile.id, { full_name: profile.full_name as string | null, username: null }])) as Record<string, Identity>
}

function displayName(identity: Identity | undefined, fallback = 'Mwanafunzi') {
  return identity?.full_name || (identity?.username ? '@' + identity.username : fallback)
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })
}

export function GroupPosts({ groupId, initialPosts }: { groupId: string; initialPosts: Post[] }) {
  const supabase = useMemo(() => createClient(), [])
  const [posts, setPosts] = useState(initialPosts)
  const [authors, setAuthors] = useState<Record<string, Identity>>({})
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    void loadIdentities(supabase, initialPosts.map((post) => post.author_id)).then((profiles) => {
      if (active) setAuthors(profiles)
    })
    return () => { active = false }
  }, [initialPosts, supabase])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (text.length < 2 || busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Ingia tena kabla ya kuweka post.')
      const { data, error: insertError } = await supabase
        .from('group_posts')
        .insert({ group_id: groupId, author_id: user.id, body: text })
        .select('id,author_id,body,created_at')
        .single()
      if (insertError) throw insertError
      setPosts((current) => [data as Post, ...current])
      const profiles = await loadIdentities(supabase, [user.id])
      setAuthors((current) => ({ ...current, ...profiles }))
      setBody('')
      setMessage('Post imechapishwa kikamilifu.')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Imeshindikana kuchapisha post.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#111923]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-slate-800">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"><MessageCircle className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h2 className="font-heading text-base font-extrabold text-slate-950 dark:text-white">Mijadala ya kikundi</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Maswali, mawazo na taarifa za kujifunza.</p>
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Users className="h-3.5 w-3.5" />{posts.length} {posts.length === 1 ? 'post' : 'posts'}</span>
    </div>

    <form onSubmit={submit} className="border-b border-slate-100 bg-slate-50/80 p-4 sm:p-5 dark:border-slate-800 dark:bg-[#0d151e]">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-xs font-black text-white shadow-sm">WE</span>
        <div className="min-w-0 flex-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 5000))}
            required
            minLength={2}
            maxLength={5000}
            rows={2}
            placeholder="Una jambo la kushirikisha kikundi? Andika hapa..."
            aria-label="Andika post ya kikundi"
            className="min-h-[76px] w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-[#111923] dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">{body.length.toLocaleString()} / 5,000</span>
            <button
              type="submit"
              disabled={busy || body.trim().length < 2}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {busy ? 'Inachapisha...' : 'Chapisha post'}
            </button>
          </div>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {message && <p role="status" className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">{message}</p>}
    </form>

    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {posts.length ? posts.map((post) => {
        const name = displayName(authors[post.author_id])
        return <article key={post.id} className="px-4 py-4 transition-colors hover:bg-slate-50/70 sm:px-5 dark:hover:bg-white/[0.02]">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-black text-white">{initials(name)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="max-w-full truncate text-sm font-extrabold text-slate-900 dark:text-slate-100">{name}</p>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <time dateTime={post.created_at} className="text-[11px] text-slate-400">{new Date(post.created_at).toLocaleString('sw-TZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-200">{post.body}</p>
            </div>
          </div>
        </article>
      }) : <div className="px-5 py-9 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"><MessageCircle className="h-5 w-5" /></span>
        <h3 className="mt-3 text-sm font-extrabold text-slate-800 dark:text-slate-100">Bado hakuna mijadala</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Kuwa wa kwanza kushiriki swali au wazo la kujifunza.</p>
      </div>}
    </div>
  </section>
}

export function StudyGroupChat({ groupId, userId, isMember, groupName, memberCount }: { groupId: string; userId: string; isMember: boolean; groupName: string; memberCount: number }) {
  const supabase = useMemo(() => createClient(), [])
  const { lowDataMode } = useDataSaver()
  const [messages, setMessages] = useState<Message[]>([])
  const [authors, setAuthors] = useState<Record<string, Identity>>({})
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    const { data, error: queryError } = await supabase.from('study_group_messages')
      .select('id,group_id,sender_id,body,attachment_paths,created_at')
      .eq('group_id', groupId).order('created_at', { ascending: true }).limit(100)
    if (queryError) {
      setError('Imeshindikana kupakia chat. Hakikisha umejiunga na kikundi.')
    } else {
      const rows = (data ?? []) as Message[]
      setMessages(rows)
      const paths = [...new Set(rows.flatMap((row) => row.attachment_paths ?? []))]
      const [profiles, signed] = await Promise.all([
        loadIdentities(supabase, rows.map((row) => row.sender_id)),
        Promise.all(paths.map(async (path) => {
          const { data: result } = await supabase.storage.from('community-attachments').createSignedUrl(path, 3600)
          return [path, result?.signedUrl ?? ''] as const
        })),
      ])
      setAuthors(profiles)
      setUrls(Object.fromEntries(signed.filter((entry) => entry[1])))
      setError('')
    }
    setLoading(false)
  }, [groupId, supabase])

  useEffect(() => {
    if (!isMember) { setLoading(false); return }
    void load()
    const channel = supabase.channel('study-group-chat-' + groupId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_group_messages', filter: 'group_id=eq.' + groupId }, () => { void load(false) })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [groupId, isMember, load, supabase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if ((!text && !files.length) || busy || !isMember) return
    setBusy(true); setError('')
    const uploaded: string[] = []
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.id !== userId) throw new Error('Session imebadilika. Ingia tena.')
      for (const file of files) {
        const name = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'attachment'
        const path = user.id + '/groups/' + groupId + '/' + crypto.randomUUID() + '-' + name
        const { error: uploadError } = await supabase.storage.from('community-attachments').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
        if (uploadError) throw uploadError
        uploaded.push(path)
      }
      const { error: insertError } = await supabase.from('study_group_messages').insert({ group_id: groupId, sender_id: user.id, body: text, attachment_paths: uploaded })
      if (insertError) throw insertError
      setBody(''); setFiles([])
      if (fileRef.current) fileRef.current.value = ''
      await load(false)
    } catch (err) {
      if (uploaded.length) await supabase.storage.from('community-attachments').remove(uploaded)
      setError(err instanceof Error ? err.message : 'Imeshindikana kutuma ujumbe.')
    } finally { setBusy(false) }
  }

  function selectFiles(list: FileList | null) {
    if (!list) return
    const picked = Array.from(list)
    if (files.length + picked.length > 4) { setError('Chagua picha/PDF zisizozidi 4 kwa ujumbe mmoja.'); return }
    if (picked.some((file) => !(file.type.startsWith('image/') || file.type === 'application/pdf'))) { setError('Aina zinazoruhusiwa ni picha na PDF pekee.'); return }
    if (picked.some((file) => file.size > 10 * 1024 * 1024)) { setError('Kila faili lisizidi 10 MB.'); return }
    setError(''); setFiles((current) => [...current, ...picked])
  }

  async function deleteMessage(item: Message) {
    if (item.sender_id !== userId || deletingId) return
    if (!window.confirm('Una uhakika unataka kufuta ujumbe huu?')) return
    setDeletingId(item.id)
    const { error: deleteError } = await supabase.from('study_group_messages').delete().eq('id', item.id).eq('sender_id', userId)
    if (deleteError) setError('Ujumbe haukufutwa: ' + deleteError.message)
    else setMessages((current) => current.filter((message) => message.id !== item.id))
    setDeletingId(null)
  }

  return <section className="sn-chat-shell flex h-[76dvh] min-h-[560px] max-h-[900px] flex-col overflow-hidden rounded-[28px] border">
    <header className="sn-chat-topbar relative flex items-center justify-between gap-3 overflow-hidden border-b px-4 py-4 text-white sm:px-5">
      <div className="pointer-events-none absolute -right-6 -top-12 h-32 w-32 rounded-full border-[18px] border-white/10" />
      <div className="relative flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10"><Users className="h-5 w-5" /></span>
        <div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-emerald-100">SmartNekam · Study Group</p><h2 className="truncate text-lg font-extrabold sm:text-xl">{groupName}</h2><p className="text-xs text-emerald-50/90">{memberCount} wanachama · Group chat</p></div>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh chat" title="Pakia upya" className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 transition hover:bg-white/20 disabled:opacity-50"><RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} /></button>
    </header>
    {!isMember ? <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center"><Users className="h-10 w-10 text-amber-600" /><h3 className="mt-4 font-extrabold text-slate-900 dark:text-white">Jiunge na group kuingia kwenye chat</h3><p className="mt-2 max-w-sm text-sm text-slate-500">Ukiwa mwanachama utaweza kusoma na kutuma ujumbe kwenye kikundi hiki.</p></div> : <>
      <div className="sn-chat-thread min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-5 sm:px-5">
        {loading && !messages.length ? <div className="space-y-3"><div className="shimmer-element h-14 w-2/3 rounded-2xl" /><div className="shimmer-element ml-auto h-14 w-1/2 rounded-2xl" /></div> :
        !messages.length ? <div className="flex h-full min-h-56 flex-col items-center justify-center text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><MessageCircle className="h-7 w-7" /></span><h3 className="mt-3 font-extrabold text-slate-900 dark:text-white">Anza mazungumzo ya group</h3><p className="mt-1 max-w-xs text-sm text-slate-500">Salimia wanachama na mshirikishane maarifa.</p></div> :
        messages.map((item) => {
          const mine = item.sender_id === userId
          const name = mine ? 'Wewe' : displayName(authors[item.sender_id])
          return <div key={item.id} className={'flex items-end gap-2 sm:gap-3 ' + (mine ? 'justify-end' : 'justify-start')}>
            {!mine && <span className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-black text-white">{initials(name)}</span>}
            <div className={'max-w-[88%] rounded-[22px] px-3.5 py-2.5 shadow-sm sm:max-w-[78%] ' + (mine ? 'rounded-br-md bg-emerald-700 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-[#121826] dark:text-slate-100')}>
              {!mine && <p className="mb-1 text-[11px] font-extrabold text-violet-700 dark:text-violet-300">{name}</p>}
              {(item.attachment_paths ?? []).map((path) => {
                const url = urls[path]
                const fileName = path.split('/').pop()?.replace(/^[0-9a-f-]{20,}-/i, '') || 'Kiambatisho'
                const isImage = /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(fileName)
                return <div key={path} className="mb-2">{!url ? <p className="text-xs">Kiambatisho kinapakia…</p> : isImage ? lowDataMode && !revealed[path] ? <button type="button" onClick={() => setRevealed((old) => ({ ...old, [path]: true }))} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-emerald-300 px-3 py-2 text-xs font-bold"><ImageIcon className="h-4 w-4" />Gusa kuonyesha picha</button> : <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={fileName} loading="lazy" decoding="async" className="max-h-64 max-w-full rounded-xl object-contain" /></a> : <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-current/15 bg-black/5 px-3 py-2 text-xs font-bold"><FileText className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 break-all">{fileName}</span><Download className="h-4 w-4 shrink-0" /></a>}</div>
              })}
              {item.body && <p className="whitespace-pre-wrap break-words text-sm leading-5">{item.body}</p>}
              <div className={'mt-1 flex items-center justify-end gap-1 text-[10px] ' + (mine ? 'text-emerald-100' : 'text-slate-400')}><span>{timeLabel(item.created_at)}</span>{mine && <Check className="h-3.5 w-3.5" />}{mine && <button type="button" onClick={() => void deleteMessage(item)} disabled={deletingId === item.id} aria-label="Futa ujumbe" className="ml-1 rounded-md p-1 hover:bg-white/15">{deletingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</button>}</div>
            </div>
            {mine && <span className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-[11px] font-black text-white">WE</span>}
          </div>
        })}
        <div ref={bottomRef} />
      </div>
      {files.length > 0 && <div className="mx-3 mb-2 flex flex-wrap gap-2 rounded-xl border border-emerald-100 bg-emerald-50/90 p-2.5 dark:border-slate-700 dark:bg-slate-900">{files.map((file, index) => <span key={file.name + file.size + index} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"><Paperclip className="h-3.5 w-3.5" /><span className="max-w-[180px] truncate">{file.name}</span><button type="button" onClick={() => setFiles((old) => old.filter((_, i) => i !== index))} aria-label="Ondoa kiambatisho"><X className="h-3.5 w-3.5" /></button></span>)}</div>}
      {error && <p role="alert" className="mx-3 mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">{error}</p>}
      <form onSubmit={submit} className="sn-chat-composer flex items-end gap-2 border-t p-3 backdrop-blur-md sm:gap-3 sm:p-4">
        <label title="Ambatanisha picha au PDF" className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-emerald-300"><Paperclip className="h-5 w-5" /><input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif,application/pdf" className="sr-only" disabled={busy} onChange={(e) => { selectFiles(e.currentTarget.files); e.currentTarget.value = '' }} /></label>
        <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 4000))} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }} rows={1} maxLength={4000} placeholder="Andika ujumbe kwa wanachama..." disabled={busy} className="sn-chat-composer-input max-h-28 min-h-11 min-w-0 flex-1 resize-y rounded-[22px] border px-4 py-3 text-sm outline-none placeholder:text-slate-400 disabled:opacity-60" />
        <button type="submit" disabled={busy || (!body.trim() && !files.length)} aria-label="Tuma ujumbe" className="sn-chat-send flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-40">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}</button>
      </form>
    </>}
  </section>
}
