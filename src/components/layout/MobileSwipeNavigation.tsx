'use client'

import { useRef, type ReactNode, type TouchEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const ROUTES = [
  { href: '/dashboard', label: 'Home' },
  { href: '/learn', label: 'Learn' },
  { href: '/communities', label: 'Jamii' },
  { href: '/profile', label: 'Profile' },
]

type StartPoint = { x: number; y: number; at: number; ignored: boolean }

function routeIndex(pathname: string) {
  return ROUTES.findIndex((route) => pathname === route.href || pathname.startsWith(`${route.href}/`))
}

function ignoreSwipe(target: EventTarget | null) {
  if (!(target instanceof Element)) return true
  return Boolean(target.closest(
    'input,textarea,select,[role="dialog"],[data-swipe-ignore],.overflow-x-auto,.overflow-x-scroll,.no-swipe-nav'
  ))
}

/** On phone, a clear left/right gesture switches primary sections. Interactive controls and horizontal scrollers are excluded. */
export default function MobileSwipeNavigation({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const start = useRef<StartPoint | null>(null)

  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0]
    if (!touch || window.matchMedia('(min-width: 1024px)').matches) { start.current = null; return }
    const edge = touch.clientX < 18 || touch.clientX > window.innerWidth - 18
    start.current = { x: touch.clientX, y: touch.clientY, at: Date.now(), ignored: edge || ignoreSwipe(event.target) }
  }

  function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const origin = start.current
    start.current = null
    const touch = event.changedTouches[0]
    if (!origin || origin.ignored || !touch || window.matchMedia('(min-width: 1024px)').matches) return
    if (Date.now() - origin.at > 850) return
    const dx = touch.clientX - origin.x
    const dy = touch.clientY - origin.y
    if (Math.abs(dx) < 85 || Math.abs(dy) > 58 || Math.abs(dx) < Math.abs(dy) * 1.45) return
    const current = routeIndex(pathname)
    if (current < 0) return
    const next = Math.max(0, Math.min(ROUTES.length - 1, current + (dx < 0 ? 1 : -1)))
    if (next !== current) router.push(ROUTES[next].href)
  }

  return <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="min-w-0" data-mobile-swipe-navigation="true">{children}</div>
}
