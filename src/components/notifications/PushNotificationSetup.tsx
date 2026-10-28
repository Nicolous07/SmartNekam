'use client'

import { useEffect, useState } from 'react'
import { BellRing, CheckCircle2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type PushNotificationSetupProps = {
  variant?: 'panel' | 'compact'
}

function decodeVapidKey(base64Key: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Key.length % 4)) % 4)
  const base64 = (base64Key + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(Array.from(raw).map((character) => character.charCodeAt(0)))
}

export default function PushNotificationSetup({ variant = 'panel' }: PushNotificationSetupProps) {
  const [busy, setBusy] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    async function syncCurrentSubscription() {
      if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return
      if (Notification.permission !== 'granted') return
      try {
        const registration = await navigator.serviceWorker.getRegistration('/')
        const subscription = await registration?.pushManager.getSubscription()
        if (active && subscription) setEnabled(true)
      } catch {
        // Keep the control available so a learner can explicitly retry from the button.
      }
    }
    void syncCurrentSubscription()
    return () => { active = false }
  }, [])

  async function enablePush() {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        throw new Error('Kivinjari hiki hakitumii arifa za kifaa. Tumia toleo jipya la Chrome, Edge, Firefox au Safari inayotumika.')
      }
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BI0OkrwyzQjkekKBtfqw6iy2QgHgtlRlvWvdQi_DFrhdx_cKWe6dwlV2PUfp8HDPoM_eNwc55OsjJj_S-QkeBDU'

      if (Notification.permission === 'denied') {
        throw new Error('Ruhusa ya arifa imezuiwa na kivinjari. Fungua mipangilio ya tovuti ya SmartNekam > Notifications > Allow, kisha rudi na ujaribu tena.')
      }
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('Chagua Allow kwenye dirisha la ruhusa. Kama halionekani, fungua Site settings > Notifications > Allow.')
      }

      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Ingia kwenye akaunti yako kwanza.')

      await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(vapidKey) as BufferSource,
        })
      }

      const deviceToken = JSON.stringify(subscription.toJSON())
      const { error: saveError } = await supabase.from('push_devices').upsert({
        user_id: user.id,
        platform: 'web',
        device_token: deviceToken,
        device_label: typeof navigator.userAgent === 'string' ? navigator.userAgent.slice(0, 120) : 'Browser device',
        is_active: true,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'device_token' })
      if (saveError) throw new Error(`Kifaa kimeruhusu arifa lakini usajili haujahifadhiwa: ${saveError.message}. Hakikisha SQL 033 imeendeshwa.`)

      setEnabled(true)
      setSuccess('Arifa zimewashwa kwenye kifaa hiki. Ili ziwasili app ikiwa imefungwa, huduma ya push ya Supabase na Database Webhook lazima pia ziwe zimewashwa.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Imeshindikana kuwasha arifa za kifaa.')
    } finally {
      setBusy(false)
    }
  }

  if (variant === 'compact') {
    return (
      <div className="border-b border-slate-100 bg-emerald-50/70 px-3 py-3 dark:border-slate-800 dark:bg-emerald-950/20 sm:px-4">
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${enabled ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'}`}>
            {enabled ? <CheckCircle2 className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-slate-900 dark:text-white">Arifa kwenye kifaa hiki</p>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-600 dark:text-slate-300">
              {enabled ? 'Ruhusa imetolewa kwenye kifaa hiki.' : 'Ruhusu SmartNekam kukutumia arifa za kifaa.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void enablePush()}
            disabled={busy}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : enabled ? <CheckCircle2 className="h-3.5 w-3.5" /> : <BellRing className="h-3.5 w-3.5" />}
            {busy ? 'Inawasha…' : enabled ? 'Imewashwa' : 'Ruhusu arifa'}
          </button>
        </div>
        {success && <p role="status" className="mt-2 text-[11px] leading-4 text-emerald-800 dark:text-emerald-200">{success}</p>}
        {error && <p role="alert" className="mt-2 text-[11px] leading-4 text-rose-700 dark:text-rose-300">{error}</p>}
      </div>
    )
  }

  return (
    <section className="geometric-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <h2 className="font-extrabold text-slate-950 dark:text-white">Arifa kwenye kifaa hiki</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Ruhusu arifa ili upate taarifa mpya kutoka SmartNekam.</p>
        {success && <p role="status" className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{success}</p>}
        {error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</p>}
      </div>
      <button type="button" onClick={() => void enablePush()} disabled={busy} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : enabled ? <CheckCircle2 className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
        {busy ? 'Inawasha…' : enabled ? 'Arifa zimewashwa' : 'Ruhusu arifa kwenye kifaa'}
      </button>
    </section>
  )
}
