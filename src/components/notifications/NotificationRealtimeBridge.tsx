'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellRing, PhoneIncoming, PhoneOff, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type NoticePayload = {
  id: string
  title: string
  body: string
  notification_type?: string
  data?: Record<string, unknown> | null
  created_at?: string
}

type CallAction = 'answer' | 'reject'
type CallActionDetail = {
  action: CallAction
  conversationId: string
  callSignalId?: string
  callerId?: string
}

const INTERNAL_NAVIGATION_NOTICE = /umefungua taarifa hii bila kuondoka kwenye ukurasa/i

function isInternalNavigationNotice(notice: NoticePayload) {
  return INTERNAL_NAVIGATION_NOTICE.test(`${notice.title} ${notice.body}`)
}

function targetForNotice(notice: NoticePayload) {
  const data = notice.data ?? {}
  const conversationId = typeof data.conversation_id === 'string' ? data.conversation_id : ''
  const postId = typeof data.post_id === 'string' ? data.post_id : ''
  const questionId = typeof data.question_id === 'string' ? data.question_id : ''
  const groupId = typeof data.group_id === 'string' ? data.group_id : ''
  const source = typeof data.source === 'string' ? data.source : ''

  if (conversationId) {
    const params = new URLSearchParams({ tab: 'chats', conversation: conversationId })
    return `/communities?${params.toString()}`
  }
  if (postId) return `/posts/${encodeURIComponent(postId)}`
  if (questionId) return `/communities/questions/${encodeURIComponent(questionId)}`
  if (groupId) return '/communities?tab=groups'
  if (source === 'mentor_request' || source === 'mentor_request_response') {
    return notice.notification_type === 'mentor' && /kubaliwa|accepted/i.test(`${notice.title} ${String(data.status ?? '')}`)
      ? '/communities?tab=chats'
      : '/communities?tab=mentors'
  }

  const href = data.href
  if (typeof href === 'string' && href.startsWith('/') && !href.startsWith('//') && !/^\/notifications\/?(?:\?|$)/.test(href)) {
    return href
  }

  switch (notice.notification_type) {
    case 'chat':
      return '/communities?tab=chats'
    case 'mentor':
      return '/communities?tab=mentors'
    case 'community':
      return '/communities'
    case 'content_review':
      return '/library'
    case 'deadline':
    case 'application':
      return '/opportunities'
    case 'achievement':
    case 'referral':
    case 'security':
      return '/profile'
    default:
      return '/dashboard'
  }
}

export default function NotificationRealtimeBridge() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [notice, setNotice] = useState<NoticePayload | null>(null)
  // Avoid showing a delayed notification after the call has already been answered/rejected.
  const recentlyResolvedCallIds = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    let disposed = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function connect() {
      const { data: { user } } = await supabase.auth.getUser()
      if (disposed || !user) return

      channel = supabase
        .channel(`smartnekam-notifications-${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          const row = payload.new as NoticePayload
          if (!row.id || isInternalNavigationNotice(row)) return
          if (row.notification_type === 'call') {
            const callSignalId = typeof row.data?.call_signal_id === 'string' ? row.data.call_signal_id : ''
            if (callSignalId) {
              const expiry = recentlyResolvedCallIds.current.get(callSignalId)
              if (expiry && expiry > Date.now()) return
            }
          }
          setNotice((current) => {
            // A regular notification must never replace a ringing call banner.
            // Calls stay visible until the call component emits smartnekam:call-resolved.
            if (current?.notification_type === 'call') return current
            return row
          })
          window.dispatchEvent(new CustomEvent('smartnekam:notification', { detail: row }))
        })
        .subscribe()
    }

    void connect()
    return () => {
      disposed = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [supabase])

  useEffect(() => {
    if (!notice || notice.notification_type === 'call') return
    const timer = window.setTimeout(() => setNotice((current) => current?.id === notice.id ? null : current), 3000)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const handleCallResolved = (event: Event) => {
      const detail = (event as CustomEvent<{ callSignalId?: string; conversationId?: string }>).detail
      const callSignalId = detail?.callSignalId
      const conversationId = detail?.conversationId
      if (callSignalId) recentlyResolvedCallIds.current.set(callSignalId, Date.now() + 5 * 60 * 1000)
      for (const [key, expiry] of recentlyResolvedCallIds.current) {
        if (expiry <= Date.now()) recentlyResolvedCallIds.current.delete(key)
      }
      setNotice((current) => {
        if (!current || current.notification_type !== 'call') return current
        const currentSignalId = typeof current.data?.call_signal_id === 'string' ? current.data.call_signal_id : ''
        const currentConversation = typeof current.data?.conversation_id === 'string' ? current.data.conversation_id : ''
        if ((callSignalId && currentSignalId === callSignalId) || (!callSignalId && conversationId && currentConversation === conversationId)) return null
        return current
      })
    }
    window.addEventListener('smartnekam:call-resolved', handleCallResolved)
    return () => window.removeEventListener('smartnekam:call-resolved', handleCallResolved)
  }, [])

  if (!notice) return null
  const isIncomingCall = notice.notification_type === 'call'
  const href = targetForNotice(notice)
  const conversationId = typeof notice.data?.conversation_id === 'string' ? notice.data.conversation_id : ''
  const callSignalId = typeof notice.data?.call_signal_id === 'string' ? notice.data.call_signal_id : undefined
  const callerId = typeof notice.data?.caller_id === 'string' ? notice.data.caller_id : undefined

  function openNotification() {
    if (isIncomingCall) return
    setNotice(null)
    router.push(href)
  }

  function openCallAction(action: CallAction) {
    if (!conversationId) {
      router.push(href)
      return
    }
    const detail: CallActionDetail = { action, conversationId, callSignalId, callerId }
    // The event serves an already-mounted chat. The URL query serves a chat mounted
    // after navigating from another screen or from a system push notification.
    window.dispatchEvent(new CustomEvent<CallActionDetail>('smartnekam:incoming-call-action', { detail }))
    const target = new URL(href, window.location.origin)
    target.searchParams.set('tab', 'chats')
    target.searchParams.set('conversation', conversationId)
    target.searchParams.set('callAction', action)
    if (callSignalId) target.searchParams.set('callSignalId', callSignalId)
    if (callerId) target.searchParams.set('callerId', callerId)
    router.push(`${target.pathname}${target.search}${target.hash}`)
  }

  return (
    <aside
      className={`fixed left-1/2 top-3 z-[100] w-[min(94vw,440px)] -translate-x-1/2 animate-in slide-in-from-top-3 duration-200 ${isIncomingCall ? 'sn-incoming-call-notice' : ''}`}
      aria-live={isIncomingCall ? 'assertive' : 'polite'}
      aria-atomic="true"
      role={isIncomingCall ? 'alertdialog' : 'status'}
      aria-label={isIncomingCall ? 'Simu ya sauti inayoingia' : 'Taarifa mpya'}
    >
      <div
        className={`overflow-hidden rounded-2xl border bg-white p-3 text-slate-900 shadow-2xl shadow-slate-950/25 dark:bg-slate-950 dark:text-white sm:p-4 ${isIncomingCall ? 'border-emerald-400 ring-2 ring-emerald-300/50 dark:border-emerald-700' : 'border-emerald-200 cursor-pointer transition hover:shadow-emerald-950/20 dark:border-emerald-900'}`}
        onClick={isIncomingCall ? undefined : openNotification}
        onKeyDown={isIncomingCall ? undefined : (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openNotification()
          }
        }}
        role={isIncomingCall ? undefined : 'link'}
        tabIndex={isIncomingCall ? undefined : 0}
      >
        <div className="flex items-start gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isIncomingCall ? 'animate-pulse bg-lime-100 text-emerald-900 dark:bg-lime-950 dark:text-lime-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}`}>
            {isIncomingCall ? <PhoneIncoming className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">{isIncomingCall ? 'SmartNekam · Simu inayoingia' : 'SmartNekam · Taarifa mpya'}</p>
            <p className="mt-1 text-sm font-extrabold">{notice.title}</p>
            {notice.body && <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{notice.body}</p>}
            {isIncomingCall ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => openCallAction('answer')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-extrabold text-white transition hover:bg-emerald-700 active:scale-[0.98]">
                  <PhoneIncoming className="h-4 w-4" /> Pokea
                </button>
                <button type="button" onClick={() => openCallAction('reject')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-extrabold text-white transition hover:bg-red-700 active:scale-[0.98]">
                  <PhoneOff className="h-4 w-4" /> Kata
                </button>
              </div>
            ) : (
              <button type="button" onClick={(event) => { event.stopPropagation(); openNotification() }} className="mt-3 inline-flex rounded-lg border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Fungua taarifa →</button>
            )}
          </div>
          {!isIncomingCall && (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); setNotice(null) }}
              aria-label="Funga taarifa"
              className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {!isIncomingCall && <div key={notice.id} className="sn-toast-progress" aria-hidden="true" />}
    </aside>
  )
}
