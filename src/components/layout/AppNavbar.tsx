'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Home, Library, MessageSquare, Terminal, Briefcase,
  ShieldCheck, Search, Plus, MoreHorizontal, X, FileUp, FileText,
  Users, CircleHelp, BookMarked, CalendarDays, Trophy, Bell, UserRound,
  Flame, BrainCircuit, Wallet, CheckCheck, ChevronLeft,
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import SearchDialog from './SearchDialog'
import { createClient } from '@/lib/supabase/client'
import { SMARTNEKAM_PAYMENTS_ENABLED } from '@/lib/payments/feature'

export type NavProfile = {
  id: string
  full_name: string | null
  avatar_url?: string | null
  role: string
  level: string | null
  xp: number
  coins: number
  streak: number
  longest_streak: number
  status: string
}

type NotificationPreview = {
  id: string
  title: string
  body: string
  notification_type: string
  data: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}

const ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/library', label: 'Library', icon: Library },
  { href: '/communities', label: 'Jamii', icon: MessageSquare },
  { href: '/learn', label: 'Learn', icon: Terminal },
  { href: '/opportunities', label: 'Fursa', icon: Briefcase },
]

function initials(name: string | null) {
  if (!name?.trim()) return 'S'
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

const QUICK_CREATE = [
  { label: 'Chapisha kwenye Home Feed', desc: 'Shiriki post, picha au swali', icon: MessageSquare, href: 'new-post' },
  { label: 'Pakia notes au past paper', desc: 'Shiriki nyenzo za masomo', icon: FileUp, href: '/library/upload' },
  { label: 'Tengeneza study group', desc: 'Soma pamoja na wenzako', icon: Users, href: '/communities?tab=groups' },
  { label: 'Uliza swali', desc: 'Pata msaada wa kitaaluma', icon: CircleHelp, href: '/communities?tab=qa&create=question' },
  { label: 'Tengeneza flashcards', desc: 'Rudia kwa kadi', icon: BookMarked, href: '/learn/flashcards' },
  { label: 'Panga ratiba', desc: 'Panga muda wa kujisomea', icon: CalendarDays, href: '/learn/planner' },
  { label: 'Tafuta fursa', desc: 'Scholarships na internships', icon: Trophy, href: '/opportunities' },
]

export default function AppNavbar({ profile, isAdmin = false }: { profile: NavProfile; isAdmin?: boolean }) {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationRows, setNotificationRows] = useState<NotificationPreview[]>([])
  const [selectedNotification, setSelectedNotification] = useState<NotificationPreview | null>(null)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [navHidden, setNavHidden] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  useEffect(() => { setNavHidden(false); setMoreOpen(false); setNotificationOpen(false); setSelectedNotification(null) }, [pathname])
  const loadNotifications = useCallback(async (showLoading = false) => {
    if (showLoading) setNotificationsLoading(true)
    try {
      const [countResult, recentResult] = await Promise.all([
        supabase.from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('is_read', false),
        supabase.from('notifications')
          .select('id,title,body,notification_type,data,is_read,created_at')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(8),
      ])
      if (!countResult.error && typeof countResult.count === 'number') {
        setUnreadNotifications(countResult.count)
      }
      if (!recentResult.error) {
        setNotificationRows((recentResult.data ?? []) as NotificationPreview[])
      }
    } finally {
      if (showLoading) setNotificationsLoading(false)
    }
  }, [profile.id, supabase])

  function openNotifications() {
    setMoreOpen(false)
    setSelectedNotification(null)
    setNotificationOpen(true)
    void loadNotifications(true)
  }

  async function openNotification(row: NotificationPreview) {
    setSelectedNotification(row)
    if (row.is_read) return

    setNotificationRows((current) => current.map((item) => item.id === row.id ? { ...item, is_read: true } : item))
    setUnreadNotifications((count) => Math.max(0, count - 1))
    const { error } = await supabase.from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('user_id', profile.id)
    if (error) {
      // Keep the popup responsive; the next realtime refresh will reconcile read state.
    }
  }

  useEffect(() => {
    void loadNotifications()
    const channel = supabase.channel(`smartnekam-navbar-notifications-${profile.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}`,
      }, () => { void loadNotifications() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [profile.id, supabase, loadNotifications])


  useEffect(() => {
    let lastY = window.scrollY
    let ticking = false
    const update = () => {
      const y = window.scrollY
      const delta = y - lastY
      if (y < 60 || delta < -8) setNavHidden(false)
      else if (delta > 8) setNavHidden(true)
      if (Math.abs(delta) > 8) lastY = y
      ticking = false
    }
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update) }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.navHidden = String(navHidden)
    return () => { delete document.documentElement.dataset.navHidden }
  }, [navHidden])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true) }
      if (e.key === 'Escape') { setCreateOpen(false); setMoreOpen(false); setSearchOpen(false); setNotificationOpen(false); setSelectedNotification(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const levelLabel = profile.level === 'O_LEVEL' ? 'O-Level' : profile.level === 'A_LEVEL' ? 'A-Level' : profile.level === 'UNIVERSITY' ? 'University' : 'Mwanafunzi'
  const allMoreItems = [
    { href: '/opportunities', label: 'Fursa na scholarships', icon: Briefcase },
    { href: '/learn/daily-challenge', label: 'Daily Challenge', icon: Flame },
    { href: '/learn/planner', label: 'Study Planner', icon: CalendarDays },
    { href: '/learn/flashcards', label: 'Flashcards', icon: BrainCircuit },
    { href: '/applications', label: 'Maombi yangu', icon: FileText },
    { href: '/notifications', label: 'Taarifa', icon: Bell },
    ...(SMARTNEKAM_PAYMENTS_ENABLED ? [{ href: '/wallet', label: 'Wallet', icon: Wallet }] : []),
    { href: '/profile', label: 'Profile na settings', icon: UserRound },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin panel', icon: ShieldCheck }] : []),
  ]

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-[#0B0F1A]/92">
        <div className="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 sm:px-5">
          <Link href="/dashboard" className="col-start-1 flex items-center gap-2 justify-self-start">
            <Image src="/images/smartnekam-mark.png" alt="SmartNekam" width={42} height={42} priority className="h-9 w-9 shrink-0 object-contain drop-shadow-sm" />
            <span className="font-heading text-base font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-lg">SmartNekam</span>
          </Link>

          <nav className="sn-nav-rail col-start-2 hidden items-center gap-1.5 rounded-[24px] px-2.5 py-1.5 lg:flex" aria-label="Urambazaji mkuu">
            <button type="button" onClick={() => setSearchOpen(true)} aria-label="Tafuta (Ctrl+K)" title="Tafuta" className="sn-nav-desktop-item"><Search className="h-5 w-5" /></button>
            {ITEMS.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-label={label} title={label} className={`sn-nav-desktop-item ${isActive(href) ? 'is-active' : ''}`}><Icon className="h-5 w-5" /></Link>)}
            {isAdmin && <Link href="/admin" aria-label="Admin Panel" title="Admin Panel" className={`sn-nav-desktop-item ${isActive('/admin') ? 'is-active' : ''}`}><ShieldCheck className="h-5 w-5" /></Link>}
          </nav>

          <div className="col-start-3 flex items-center gap-1.5 justify-self-end sm:gap-2">
            <button type="button" onClick={() => setSearchOpen(true)} aria-label="Tafuta" className="rounded-xl p-2 text-slate-600 hover:bg-emerald-50 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"><Search className="h-5 w-5" /></button>
            <div className="relative lg:hidden">
              <button type="button" onClick={() => setMoreOpen((value) => !value)} aria-label="Fungua menyu ya ziada" aria-expanded={moreOpen} className="rounded-xl p-2 text-slate-600 hover:bg-violet-50 dark:text-slate-300 dark:hover:bg-slate-800"><MoreHorizontal className="h-5 w-5" /></button>
              {moreOpen && <div className="anim-sheet-up absolute right-0 top-full z-[70] mt-2 max-h-[70vh] w-60 overflow-y-auto rounded-2xl border border-violet-100 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-[#121826]">{allMoreItems.map(({ href, label, icon: Icon }) => {
                const itemContent = <><span className="relative"><Icon className="h-4 w-4 text-violet-500" />{href === '/notifications' && unreadNotifications > 0 && <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-rose-600 px-1 text-center text-[9px] font-black leading-4 text-white">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}</span>{label}</>
                return href === '/notifications'
                  ? <button key={href} type="button" onClick={openNotifications} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-violet-50 dark:text-slate-200 dark:hover:bg-slate-800">{itemContent}</button>
                  : <Link key={href} href={href} onClick={() => setMoreOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-violet-50 dark:text-slate-200 dark:hover:bg-slate-800">{itemContent}</Link>
              })}<div className="mt-1 border-t border-slate-100 p-2 dark:border-slate-800"><ThemeToggle /></div></div>}
            </div>
            <button type="button" onClick={openNotifications} aria-label="Taarifa" title="Taarifa" aria-haspopup="dialog" aria-expanded={notificationOpen} className="hidden rounded-xl p-2 text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700 lg:inline-flex dark:text-slate-300 dark:hover:bg-slate-800"><span className="relative inline-flex"><Bell className="h-4.5 w-4.5" />{unreadNotifications > 0 && <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-rose-600 px-1 text-center text-[9px] font-black leading-4 text-white">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}</span></button>
            <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-800 lg:flex dark:bg-emerald-950 dark:text-emerald-200"><Flame className="h-3.5 w-3.5" />{profile.streak}</span>
            <Link href="/profile" title="XP na coins" className="hidden items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-800 lg:flex dark:bg-amber-950 dark:text-amber-200"><span>XP</span>{profile.xp}</Link>
            <span className="hidden lg:block"><ThemeToggle /></span>
            <Link href="/profile" aria-label="Fungua profile" className={`hidden lg:flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-1 transition xl:pr-3 ${isActive('/profile') ? 'bg-emerald-100 dark:bg-emerald-950' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-500 to-emerald-800 text-xs font-extrabold text-white ring-2 ring-emerald-200 dark:ring-emerald-900">{profile.avatar_url ? <img src={profile.avatar_url} alt="Picha ya profile" className="h-full w-full object-cover" /> : initials(profile.full_name)}</span>
              <span className="hidden max-w-[104px] truncate text-sm font-bold text-slate-800 xl:block dark:text-slate-100">{profile.full_name?.split(' ')[0] ?? 'Profile'}</span>
            </Link>
          </div>
        </div>
      </header>

      {createOpen && <div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/55 p-3 pb-24 backdrop-blur-sm sm:items-center sm:pb-3" onClick={() => setCreateOpen(false)}>
        <section role="dialog" aria-modal="true" aria-labelledby="quick-create-title" onClick={(e) => e.stopPropagation()} className="anim-sheet-up geometric-card w-full max-w-lg rounded-3xl p-4 shadow-2xl sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">SmartNekam tools</p><h2 id="quick-create-title" className="mt-1 text-xl font-extrabold text-slate-950 dark:text-white">Unda kitu kipya</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Chagua hatua ya kuendelea nayo.</p></div><button type="button" onClick={() => setCreateOpen(false)} aria-label="Funga" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button></div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{QUICK_CREATE.map(({ label, desc, icon: Icon, href }) => href === 'new-post' ? <button key={label} type="button" onClick={() => { setCreateOpen(false); window.dispatchEvent(new Event('smartnekam:create-post')) }} className="flex min-h-28 flex-col items-start rounded-2xl border border-emerald-100 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Icon className="h-4 w-4" /></span><span className="mt-2 text-xs font-extrabold leading-4 text-slate-950 dark:text-white">{label}</span><span className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">{desc}</span></button> : <Link key={label} href={href} onClick={() => setCreateOpen(false)} className="flex min-h-28 flex-col items-start rounded-2xl border border-emerald-100 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Icon className="h-4 w-4" /></span><span className="mt-2 text-xs font-extrabold leading-4 text-slate-950 dark:text-white">{label}</span><span className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">{desc}</span></Link>)}</div>
        </section>
      </div>}

      <nav data-swipe-ignore="true" aria-label="Urambazaji wa simu" className={`fixed inset-x-3 bottom-[max(0.6rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-xl transition-transform duration-300 ease-out lg:hidden ${navHidden ? 'translate-y-[150%]' : 'translate-y-0'}`}>
        <div className="sn-nav-rail sn-mobile-nav-grid rounded-[27px] shadow-[0_18px_45px_rgba(0,0,0,0.32)]">
          {ITEMS.slice(0, 2).map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-label={label} title={label} className={`sn-mobile-nav-item ${isActive(href) ? 'is-active' : ''}`}>
            <span className="sn-mobile-nav-icon"><Icon className="h-5 w-5" /></span><span className="sn-mobile-nav-label">{label}</span>
          </Link>)}
          <button type="button" onClick={() => setCreateOpen(true)} aria-label="Unda kitu kipya" title="Unda post au pakia nyenzo" className="sn-mobile-nav-item sn-mobile-nav-create">
            <span className="sn-mobile-nav-icon"><Plus className="h-5 w-5" /></span><span className="sn-mobile-nav-label">Unda</span>
          </button>
          {ITEMS.slice(2, 4).map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-label={label} title={label} className={`sn-mobile-nav-item ${isActive(href) ? 'is-active' : ''}`}>
            <span className="sn-mobile-nav-icon"><Icon className="h-5 w-5" /></span><span className="sn-mobile-nav-label">{label}</span>
          </Link>)}
        </div>
      </nav>
      {notificationOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 p-3 pb-24 backdrop-blur-sm sm:items-start sm:justify-end sm:pb-3 sm:pt-[4.5rem]"
          onClick={() => { setNotificationOpen(false); setSelectedNotification(null) }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="navbar-notifications-title"
            onClick={(event) => event.stopPropagation()}
            className="anim-sheet-up geometric-card flex max-h-[72vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-emerald-100 p-0 shadow-2xl dark:border-slate-700 sm:max-h-[min(78vh,620px)]"
          >
            <header className="flex items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
              {selectedNotification && (
                <button type="button" onClick={() => setSelectedNotification(null)} aria-label="Rudi kwenye orodha ya taarifa" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <h2 id="navbar-notifications-title" className="font-extrabold text-slate-950 dark:text-white">
                  {selectedNotification ? 'Maelezo ya taarifa' : 'Taarifa zako'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {selectedNotification ? 'Ujumbe uliofunguliwa ndani ya popup' : unreadNotifications > 0 ? `${unreadNotifications} hazijasomwa` : 'Upo kwenye taarifa zako za hivi karibuni'}
                </p>
              </div>
              <button type="button" onClick={() => { setNotificationOpen(false); setSelectedNotification(null) }} aria-label="Funga taarifa" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </header>

            {selectedNotification ? (
              <div className="overflow-y-auto p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                  <Bell className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-extrabold text-slate-950 dark:text-white">{selectedNotification.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{selectedNotification.body || 'Hakuna maelezo zaidi ya taarifa hii.'}</p>
                <p className="mt-4 text-xs text-slate-400">{new Date(selectedNotification.created_at).toLocaleString('sw-TZ', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Dar_es_Salaam' })}</p>
                <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                  <CheckCheck className="h-4 w-4 shrink-0" />
                  Umefungua taarifa hii bila kuondoka kwenye ukurasa.
                </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {notificationsLoading ? (
                  <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">Inapakia taarifa...</p>
                ) : notificationRows.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="mx-auto h-8 w-8 text-emerald-600" />
                    <p className="mt-3 font-bold text-slate-900 dark:text-white">Bado hakuna taarifa</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Taarifa mpya zitaonekana hapa.</p>
                  </div>
                ) : notificationRows.map((row) => (
                  <button
                    type="button"
                    key={row.id}
                    onClick={() => void openNotification(row)}
                    className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition hover:bg-emerald-50 dark:hover:bg-slate-800 ${row.is_read ? 'opacity-75' : 'bg-emerald-50/60 dark:bg-emerald-950/20'}`}
                  >
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"><Bell className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-extrabold text-slate-900 dark:text-white">{row.title}</span>
                        {!row.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-600 dark:text-slate-300">{row.body}</span>
                      <span className="mt-2 block text-[10px] text-slate-400">{new Date(row.created_at).toLocaleString('sw-TZ', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Dar_es_Salaam' })}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
