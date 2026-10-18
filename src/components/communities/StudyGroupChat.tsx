'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Loader2, MessageCircle, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Message = { id: string; group_id: string; sender_id: string; body: string; created_at: string }
type Post = { id: string; author_id: string; body: string; created_at: string }

export function GroupPosts({ groupId, initialPosts }: { groupId: string; initialPosts: Post[] }) {
  const supabase = useMemo(() => createClient(), [])
  const [posts, setPosts] = useState(initialPosts)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Ingia tena kabla ya kuweka post.')
      const { data, error: insertError } = await supabase.from('group_posts').insert({ group_id: groupId, author_id: user.id, body: body.trim() }).select('id,author_id,body,created_at').single()
      if (insertError) throw insertError
      setPosts((current) => [data as Post, ...current]); setBody(''); setMessage('Post imechapishwa.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Imeshindikana kuchapisha post.') }
    finally { setBusy(false) }
  }
  return <section className="geometric-card space-y-4 p-4 sm:p-5">
    <div><h2 className="font-heading text-lg font-extrabold text-slate-950 dark:text-white">Posts za kikundi</h2><p className="text-xs text-slate-500">Shiriki dokezo, swali au taarifa ya kujifunza.</p></div>
    <form onSubmit={submit} className="space-y-2"><textarea value={body} onChange={(e) => setBody(e.target.value)} required minLength={2} maxLength={5000} rows={3} placeholder="Andika post ya kikundi..." className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"/><button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>} Chapisha</button></form>
    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    <div className="space-y-3">{posts.length ? posts.map((p) => <article key={p.id} className="rounded-xl border border-emerald-100 p-3 dark:border-slate-800"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{p.body}</p><p className="mt-2 text-[11px] text-slate-400">{new Date(p.created_at).toLocaleString('sw-TZ')} · Mwanafunzi</p></article>) : <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500 dark:border-slate-700">Bado hakuna posts. Anzisha mazungumzo ya kwanza.</p>}</div>
  </section>
}

export function StudyGroupChat({ groupId, userId, isMember }: { groupId: string; userId: string; isMember: boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data, error: queryError } = await supabase.from('study_group_messages').select('id,group_id,sender_id,body,created_at').eq('group_id', groupId).order('created_at', { ascending: true }).limit(100)
    if (queryError) setError('Imeshindikana kupakia chat. Hakikisha umejiunga na kikundi.')
    else setMessages((data ?? []) as Message[])
    setLoading(false)
  }
  useEffect(() => { if (isMember) void load(); else setLoading(false) /* load stable for the current group */ }, [isMember, groupId])

  async function submit(e: FormEvent) {
    e.preventDefault(); const text = body.trim(); if (!text || busy || !isMember) return
    setBusy(true); setError('')
    try {
      const { error: insertError } = await supabase.from('study_group_messages').insert({ group_id: groupId, sender_id: userId, body: text })
      if (insertError) throw insertError
      setBody(''); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Imeshindikana kutuma ujumbe.') }
    finally { setBusy(false) }
  }
  return <section className="geometric-card flex min-h-[320px] flex-col p-4 sm:p-5"><div className="mb-3 flex items-center gap-2"><MessageCircle className="h-5 w-5 text-emerald-600"/><div><h2 className="font-heading font-extrabold text-slate-950 dark:text-white">Group chat</h2><p className="text-xs text-slate-500">Ujumbe wa wanachama wa kikundi.</p></div><button type="button" onClick={() => void load()} className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold dark:border-slate-700">Refresh</button></div>
  {!isMember ? <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Jiunge na kikundi ili kusoma na kutuma ujumbe wa chat.</div> : <><div className="mb-3 max-h-96 flex-1 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">{loading ? <p className="p-4 text-center text-sm text-slate-500">Inapakia chat...</p> : messages.length ? messages.map((m) => <div key={m.id} className={`max-w-[90%] rounded-2xl px-3 py-2 ${m.sender_id === userId ? 'ml-auto bg-emerald-600 text-white' : 'bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100'}`}><p className="whitespace-pre-wrap break-words text-sm">{m.body}</p><p className={`mt-1 text-[10px] ${m.sender_id === userId ? 'text-emerald-100' : 'text-slate-400'}`}>{m.sender_id === userId ? 'Wewe' : 'Mwanafunzi'} · {new Date(m.created_at).toLocaleTimeString('sw-TZ',{hour:'2-digit',minute:'2-digit'})}</p></div>) : <p className="p-6 text-center text-sm text-slate-500">Hakuna ujumbe bado. Anza kuwasalimia wanachama.</p>}</div><form onSubmit={submit} className="flex items-end gap-2"><textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} required placeholder="Andika ujumbe..." className="min-w-0 flex-1 resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"/><button disabled={busy || !body.trim()} aria-label="Tuma ujumbe" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}</button></form></>}{error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}</section>
}
