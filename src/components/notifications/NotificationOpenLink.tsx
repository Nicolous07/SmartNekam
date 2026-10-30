'use client'

import type { MouseEvent, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function NotificationOpenLink({ id, href, read, title, className, children }: {
  id: string
  href: string
  read: boolean
  title: string
  className?: string
  children: ReactNode
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function open(event: MouseEvent<HTMLAnchorElement>) {
    if (read || busy || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    setBusy(true)
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', user.id)
        if (error) throw error
      }
      router.push(href)
    } catch {
      // Hifadhi hali ya unread ikiwa database haijakubali update.
      setBusy(false)
    }
  }

  return (
    <Link href={href} onClick={(event) => void open(event)} aria-label={'Fungua taarifa: ' + title} aria-busy={busy} className={className}>
      {children}
    </Link>
  )
}
