'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Loader2, MessageCircle, Send, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Identity = { full_name: string | null; username: string | null }
type Message = { id: string; group_id: string; sender_id: string; body: string; created_at: string }
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
    void loadIdentities(supabase, initialPosts.map((post) => post.author_id)).then((profiles) => { if (active) setAuthors(profiles) })
    return () => { active = false }
  }, [initialPosts, supabase])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setMessage('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Ingia tena kabla ya kuweka post.')
      const { data, error: insertError } = await supabase.from('group_posts').insert({ group_id: groupId, author_id: user.id, body: body.trim() }).select('id,author_id,body,created_at').single()
      if (insertError) throw insertError
      setPosts((current) => [data as Post, ...current])
      const authorIdentity = await loadIdentities(supabase, [user.id])
      setAuthors((current) => ({ ...current, ...authorIdentity }))
      setBody(''); setMessage('Post imechapishwa.')
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Imeshindikana kuchapisha post.') }
    finally { setBusy(false) }
  }

  return <section className="geometric-card space-y-4 p-4 sm:p-5">
    <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200"><Users className="h-5 w-5" /></span><div><h2 className="font-heading text-lg font-extrabold text-slate-950 dark:text-white">Posts za kikundi</h2><p className="text-xs text-slate-500">Shiriki dokezo, swali au taarifa ya kujifunza.</p></div></div>
    <form onSubmit={submit} className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70"><textarea value={body} onChange={(e) => setBody(e.target.value)} required minLength={2} maxLength={5000} rows={3} placeholder="Andika post ya kikundi..." className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /><div className="flex justify-end"><button disabled={busy || !body.trim()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Chapisha</button></div></form>
    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    <div className="space-y-3">{posts.length ? posts.map((post) => { const name=displayName(authors[post.author_id]);return <article key={post.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><div className="flex items-center gap-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-black text-white">{initials(name)}</span><div className="min-w-0"><p className="truncate text-xs font-extrabold text-slate-900 dark:text-white">{name}</p><p className="text-[11px] text-slate-400">{new Date(post.created_at).toLocaleString('sw-TZ')}</p></div></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{post.body}</p></article>}) : <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500 dark:border-slate-700">Bado hakuna posts. Anzisha mazungumzo ya kwanza.</p>}</div>
  </section>
}

export function StudyGroupChat({ groupId, userId, isMember }: { groupId: string; userId: string; isMember: boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<Message[]>([])
  const [authors, setAuthors] = useState<Record<string, Identity>>({})
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data, error: queryError } = await supabase.from('study_group_messages').select('id,group_id,sender_id,body,created_at').eq('group_id', groupId).order('created_at', { ascending: true }).limit(100)
    if (queryError) setError('Imeshindikana kupakia chat. Hakikisha umejiunga na kikundi.')
    else {
      const rows = (data ?? []) as Message[]
      setMessages(rows)
      setAuthors(await loadIdentities(supabase, rows.map((row) => row.sender_id)))
      setError('')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isMember) void load()
    else setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMember, groupId])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text || busy || !isMember) return
    setBusy(true); setError('')
    try {
      const { error: insertError } = await supabase.from('study_group_messages').insert({ group_id: groupId, sender_id: userId, body: text })
      if (insertError) throw insertError
      setBody('')
      await load()
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Imeshindikana kutuma ujumbe.') }
    finally { setBusy(false) }
  }

  return <section className="geometric-card flex min-h-[320px] flex-col p-4 sm:p-5">
    <div className="mb-3 flex items-center gap-2"><MessageCircle className="h-5 w-5 text-emerald-600" /><div><h2 className="font-heading font-extrabold text-slate-950 dark:text-white">Group chat</h2><p className="text-xs text-slate-500">Ujumbe wa wanachama wa kikundi.</p></div><button type="button" onClick={() => void load()} className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold dark:border-slate-700">Refresh</button></div>
    {!isMember ? <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Jiunge na kikundi ili kusoma na kutuma ujumbe wa chat.</div> : <>
      <div className="mb-3 max-h-96 flex-1 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
        {loading ? <p className="p-4 text-center text-sm text-slate-500">Inapakia chat...</p> : messages.length ? messages.map((item) => {
          const mine=item.sender_id===userId
          const name=mine?'Wewe':displayName(authors[item.sender_id])
          return <div key={item.id} className={'max-w-[90%] rounded-2xl px-3 py-2 '+(mine?'ml-auto bg-emerald-600 text-white':'bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100')}>{!mine&&<p className="mb-1 text-[11px] font-extrabold text-violet-700 dark:text-violet-300">{name}</p>}<p className="whitespace-pre-wrap break-words text-sm">{item.body}</p><p className={'mt-1 text-[10px] '+(mine?'text-emerald-100':'text-slate-400')}>{name} · {new Date(item.created_at).toLocaleTimeString('sw-TZ',{hour:'2-digit',minute:'2-digit'})}</p></div>
        }) : <p className="p-6 text-center text-sm text-slate-500">Hakuna ujumbe bado. Anza kuwasalimia wanachama.</p>}
      </div>
      <form onSubmit={submit} className="flex items-end gap-2"><textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} required placeholder="Andika ujumbe..." className="min-w-0 flex-1 resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /><button disabled={busy || !body.trim()} aria-label="Tuma ujumbe" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button></form>
    </>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
  </section>
}
