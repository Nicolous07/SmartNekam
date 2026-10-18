'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Code2, Flag, Loader2, Lock, Send, Trash2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ChatText from './ChatText'

export type ChatMessage = {
  id: string
  room_id: string
  author_id: string
  content: string
  created_at: string
  author_name: string | null
  author_username: string | null
  author_avatar: string | null
  author_role: string | null
}

const COLS =
  'id, room_id, author_id, content, created_at, author_name, author_username, author_avatar, author_role'
const PAGE = 50
const REPORT_REASONS = [
  'Matusi au lugha chafu',
  'Spam au utapeli',
  'Unyanyasaji au vitisho',
  'Nyingine',
]

const ROLE_LABELS: Record<string, string> = {
  secondary_student: 'Mwanafunzi',
  university_student: 'Mwanachuo',
  verified_university_student: 'Mwanachuo',
  campus_ambassador: 'Ambassador',
  course_rep: 'Course Rep',
  moderator: 'Moderator',
  super_admin: 'Admin',
}

function friendly(message?: string) {
  const m = message ?? ''
  if (m.includes('rate_limited')) return 'Unatuma haraka sana. Subiri sekunde chache.'
  if (m.includes('blocked_content')) return 'Ujumbe una maneno au kiungo kisichoruhusiwa.'
  if (m.includes('sanctioned'))
    return 'Umezuiwa kuandika kwa sasa kwa sababu ya kukiuka kanuni za jamii.'
  if (m.includes('row-level security') || m.includes('42501'))
    return 'Huna ruhusa ya kuandika kwenye chumba hiki.'
  return 'Imeshindikana kutuma. Jaribu tena.'
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'U'
  )
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('sw-TZ', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Dar_es_Salaam',
  })
}

export default function RoomChat({
  roomId,
  canPost,
  lockedMessage,
  currentUserId,
  isStaff,
  initialMessages,
}: {
  roomId: string
  canPost: boolean
  lockedMessage: string
  currentUserId: string
  isStaff: boolean
  initialMessages: ChatMessage[]
}) {
  const supabase = useMemo(() => createClient(), [])
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const stick = useRef(true)

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [hasMore, setHasMore] = useState(initialMessages.length >= PAGE)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [reportingId, setReportingId] = useState<string | null>(null)
  const [reportedId, setReportedId] = useState<string | null>(null)

  const addMessage = useCallback((m: ChatMessage) => {
    setMessages((prev) =>
      prev.some((x) => x.id === m.id)
        ? prev
        : [...prev, m].sort((a, b) => a.created_at.localeCompare(b.created_at))
    )
  }, [])

  // Anza chini ya mazungumzo
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  // Ujumbe mpya ukiingia, shuka chini kama mtumiaji yuko karibu na mwisho
  useEffect(() => {
    const el = listRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [messages])

  // Realtime: ujumbe mpya na uliofutwa
  useEffect(() => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const id = (payload.new as { id?: string }).id
          if (!id) return
          const { data } = await supabase
            .from('room_messages_feed')
            .select(COLS)
            .eq('id', id)
            .maybeSingle()
          if (data) addMessage(data as ChatMessage)
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'room_messages' },
        (payload) => {
          const id = (payload.old as { id?: string }).id
          if (id) setMessages((prev) => prev.filter((m) => m.id !== id))
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, roomId, addMessage])

  function onScroll() {
    const el = listRef.current
    if (!el) return
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  async function loadOlder() {
    const el = listRef.current
    const oldest = messages[0]
    if (!el || !oldest || loadingOlder) return
    setLoadingOlder(true)
    const prevHeight = el.scrollHeight
    const { data } = await supabase
      .from('room_messages_feed')
      .select(COLS)
      .eq('room_id', roomId)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE)
    const older = ((data ?? []) as ChatMessage[]).reverse()
    stick.current = false
    setMessages((prev) => [...older, ...prev])
    setHasMore(older.length >= PAGE)
    setLoadingOlder(false)
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight - prevHeight
    })
  }

  async function send() {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    setError('')
    const { data, error: insErr } = await supabase
      .from('room_messages')
      .insert({ room_id: roomId, author_id: currentUserId, content })
      .select('id')
      .single()

    if (insErr || !data) {
      setError(friendly(insErr?.message))
    } else {
      setText('')
      if (inputRef.current) inputRef.current.style.height = 'auto'
      stick.current = true
      const { data: row } = await supabase
        .from('room_messages_feed')
        .select(COLS)
        .eq('id', data.id)
        .maybeSingle()
      if (row) addMessage(row as ChatMessage)
    }
    setSending(false)
    inputRef.current?.focus()
  }

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value.slice(0, 2000))
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }

  function insertCodeBlock() {
    const block = '```\n\n```'
    setText((t) => (t && !t.endsWith('\n') ? t + '\n' : t) + block)
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      const pos = el.value.length - 4
      el.setSelectionRange(pos, pos)
    })
  }

  async function removeMessage(id: string) {
    const { error: delErr } = await supabase.from('room_messages').delete().eq('id', id)
    if (!delErr) setMessages((prev) => prev.filter((m) => m.id !== id))
  }

  async function report(id: string, reason: string) {
    const { error: rpcErr } = await supabase.rpc('report_message', {
      p_message: id,
      p_reason: reason,
    })
    setReportingId(null)
    if (!rpcErr) {
      setReportedId(id)
      setTimeout(() => setReportedId(null), 3000)
    }
  }

  return (
    <div className="geometric-card flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Orodha ya ujumbe */}
      <div ref={listRef} onScroll={onScroll} className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {hasMore && (
          <div className="py-2 text-center">
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingOlder}
              className="rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950"
            >
              {loadingOlder ? 'Inapakia...' : 'Pakia ujumbe wa zamani'}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Bado hakuna ujumbe. Anza mazungumzo!
          </p>
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1]
          const header =
            !prev ||
            prev.author_id !== m.author_id ||
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000
          const mine = m.author_id === currentUserId
          const name = m.author_name ?? m.author_username ?? 'Mtumiaji'

          return (
            <div key={m.id} className={`group anim-fade-in ${header ? 'mt-3' : 'mt-0.5'}`}>
              <div className="flex gap-2.5">
                <div className="w-8 shrink-0">
                  {header && (
                    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-emerald-600 text-xs font-bold text-white">
                      {m.author_avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.author_avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        initials(name)
                      )}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {header && (
                    <p className="flex flex-wrap items-center gap-x-2 text-xs">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{name}</span>
                      {m.author_role && ROLE_LABELS[m.author_role] && m.author_role !== 'secondary_student' && (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          {ROLE_LABELS[m.author_role]}
                        </span>
                      )}
                      <span className="text-slate-400" suppressHydrationWarning>
                        {timeLabel(m.created_at)}
                      </span>
                    </p>
                  )}
                  <ChatText text={m.content} />

                  {reportingId === m.id && (
                    <div className="anim-fade-up mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-slate-500">Sababu:</span>
                      {REPORT_REASONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => report(m.id, r)}
                          className="rounded-full border border-red-300 px-2 py-0.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
                        >
                          {r}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setReportingId(null)}
                        className="text-xs text-slate-400 hover:underline"
                      >
                        Ghairi
                      </button>
                    </div>
                  )}
                  {reportedId === m.id && (
                    <p className="anim-fade-in mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <Check className="h-3.5 w-3.5" /> Ripoti imetumwa kwa wasimamizi. Asante.
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-start gap-0.5 opacity-60 transition sm:opacity-0 sm:group-hover:opacity-100">
                  {!mine && (
                    <button
                      type="button"
                      onClick={() => setReportingId(reportingId === m.id ? null : m.id)}
                      aria-label="Ripoti ujumbe"
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    >
                      <Flag className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {(mine || isStaff) && (
                    <button
                      type="button"
                      onClick={() => removeMessage(m.id)}
                      aria-label="Futa ujumbe"
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Sehemu ya kuandika */}
      {canPost ? (
        <div className="border-t border-emerald-100 p-2.5 dark:border-slate-800">
          {error && (
            <p className="anim-scale-in mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={insertCodeBlock}
              aria-label="Weka kodi"
              title="Weka kodi"
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 active:scale-90 dark:hover:bg-slate-800"
            >
              <Code2 className="h-5 w-5" />
            </button>
            <textarea
              ref={inputRef}
              value={text}
              onChange={onChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              rows={1}
              placeholder="Andika ujumbe... (Shift+Enter kwa mstari mpya)"
              className="max-h-36 flex-1 resize-none rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !text.trim()}
              aria-label="Tuma"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-500 active:scale-90 disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-t border-emerald-100 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
          <Lock className="h-4 w-4 shrink-0 text-slate-400" />
          {lockedMessage}
        </div>
      )}
    </div>
  )
}
