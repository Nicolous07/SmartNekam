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
  const [error, setError] = useState('')

  async function open(event: MouseEvent<HTMLAnchorElement>) {
    if (read || busy || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    setBusy(true)
    setError('')
    const supabase = createClient()
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Ingia tena kwenye akaunti yako kisha ujaribu kufungua taarifa.')
      const { data, error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .select('id')
        .maybeSingle()
      if (updateError) throw updateError
      if (!data) throw new Error('Taarifa haikuweza kuwekwa kuwa imesomwa. Hakiki ruhusa ya akaunti kisha ujaribu tena.')
      router.push(href)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Imeshindikana kuweka taarifa kuwa imesomwa.')
      setBusy(false)
    }
  }

  return (
    <>
      <Link href={href} onClick={(event) => void open(event)} aria-label={'Fungua taarifa: ' + title} aria-busy={busy} className={className}>
        {children}
      </Link>
      {error && <p role="alert" className="basis-full pt-1 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
    </>
  )
}
