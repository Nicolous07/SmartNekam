import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bell, BellRing, CalendarClock, CheckCircle2, Info, PhoneIncoming, ShieldCheck, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import MarkNotificationReadButton from '@/components/learning/MarkNotificationReadButton'
import NotificationOpenLink from '@/components/notifications/NotificationOpenLink'
import PushNotificationSetup from '@/components/notifications/PushNotificationSetup'

type Notice = {
  id: string
  title: string
  body: string
  notification_type: string
  data: Record<string, unknown> | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

const INTERNAL_NAVIGATION_NOTICE = /umefungua taarifa hii bila kuondoka kwenye ukurasa/i

function isInternalNavigationNotice(row: Notice) {
  return INTERNAL_NAVIGATION_NOTICE.test(`${row.title} ${row.body}`)
}

function targetFor(row: Notice) {
  const data = row.data ?? {}
  const conversationId = typeof data.conversation_id === 'string' ? data.conversation_id : ''
  const postId = typeof data.post_id === 'string' ? data.post_id : ''
  const questionId = typeof data.question_id === 'string' ? data.question_id : ''
  const groupId = typeof data.group_id === 'string' ? data.group_id : ''
  const source = typeof data.source === 'string' ? data.source : ''
  const status = typeof data.status === 'string' ? data.status : ''

  // Prefer the specific record over a legacy generic /notifications URL.
  if (conversationId) {
    const params = new URLSearchParams({ tab: 'chats', conversation: conversationId })
    return `/communities?${params.toString()}`
  }
  if (postId) return `/posts/${encodeURIComponent(postId)}`
  if (questionId) return `/communities/questions/${encodeURIComponent(questionId)}`
  if (groupId) return '/communities?tab=groups'
  if (source === 'mentor_request') return '/communities?tab=mentors'
  if (source === 'mentor_request_response') {
    return status === 'accepted' ? '/communities?tab=chats' : '/communities?tab=mentors'
  }

  const value = data.href
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !/^\/notifications\/?(?:\?|$)/.test(value)) {
    return value
  }

  switch (row.notification_type) {
    case 'chat':
      return '/communities?tab=chats'
    case 'mentor':
      return '/communities?tab=mentors'
    case 'community':
      return '/communities'
    case 'content_review':
      return '/library'
    case 'deadline':
      return '/opportunities'
    case 'application':
      return '/applications'
    case 'achievement':
    case 'referral':
    case 'security':
      return '/profile'
    default:
      return '/dashboard'
  }
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')
  const { data, error } = await supabase
    .from('notifications')
    .select('id,title,body,notification_type,data,is_read,read_at,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const rows = ((data ?? []) as Notice[]).filter((row) => !isInternalNavigationNotice(row))
  const unread = rows.filter((row) => !row.is_read).length

  return <div className="mx-auto max-w-3xl space-y-5">
    <section className="geometric-hero relative overflow-hidden rounded-3xl p-6 text-white sm:p-8">
      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full border-[28px] border-white/10" />
      <div className="relative flex items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold"><BellRing className="h-3.5 w-3.5" /> SMART ALERTS</span>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Taarifa</h1>
          <p className="mt-2 max-w-xl text-sm text-emerald-50">Vikumbusho vya kujifunza, maendeleo, usalama na fursa zako.</p>
        </div>
        <span className="rounded-2xl border border-white/20 bg-black/10 px-4 py-3 text-center">
          <span className="block text-2xl font-black">{unread}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Hazijasomwa</span>
        </span>
      </div>
    </section>

    <PushNotificationSetup variant="compact" />

    {error && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">Taarifa hazijapakiwa: {error.message}</p>}

    {rows.length === 0 ? (
      <section className="geometric-card p-8 text-center">
        <Bell className="mx-auto h-9 w-9 text-emerald-600" />
        <h2 className="mt-3 font-bold text-slate-900 dark:text-white">Bado hakuna taarifa</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Ukipata updates au vikumbusho, vitaonekana hapa.</p>
        <Link href="/learn/daily-challenge" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white">Jaribu Daily Challenge <Sparkles className="h-4 w-4" /></Link>
      </section>
    ) : (
      <div className="space-y-2">
        {rows.map((row) => {
          const href = targetFor(row)
          const Icon = row.notification_type === 'call'
            ? PhoneIncoming
            : row.notification_type === 'deadline'
              ? CalendarClock
              : row.notification_type === 'achievement'
                ? CheckCircle2
                : row.notification_type === 'security'
                  ? ShieldCheck
                  : Info

          return (
            <article key={row.id} className={`geometric-card flex items-start gap-3 p-4 ${row.is_read ? 'opacity-75' : ''}`}>
              <NotificationOpenLink
                id={row.id}
                href={href}
                read={row.is_read}
                title={row.title}
                className="flex min-w-0 flex-1 items-start gap-3 rounded-xl outline-none transition hover:bg-emerald-50/50 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-slate-800/50"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  row.notification_type === 'call'
                    ? 'bg-lime-100 text-emerald-800 dark:bg-lime-950 dark:text-lime-200'
                    : row.notification_type === 'deadline'
                      ? 'bg-amber-100 text-amber-700'
                      : row.notification_type === 'achievement'
                        ? 'bg-teal-100 text-teal-700'
                        : row.notification_type === 'security'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-slate-900 dark:text-white">{row.title}</h2>
                    {!row.is_read && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{row.body}</p>
                  <p className="mt-2 text-xs text-slate-400">{new Date(row.created_at).toLocaleString('sw-TZ', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Dar_es_Salaam' })}</p>
                  <span className="mt-2 inline-block text-xs font-bold text-emerald-700 dark:text-emerald-300">Gusa kufungua →</span>
                </div>
              </NotificationOpenLink>
              {row.is_read
                ? <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2 py-2 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" /> Imesomwa</span>
                : <MarkNotificationReadButton id={row.id} />}
            </article>
          )
        })}
      </div>
    )}
  </div>
}
