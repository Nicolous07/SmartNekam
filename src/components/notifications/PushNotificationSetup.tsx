'use client'

import { useState } from 'react'
import { BellRing, CheckCircle2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function decodeVapidKey(base64Key: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Key.length % 4)) % 4)
  const base64 = (base64Key + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(Array.from(raw).map((character) => character.charCodeAt(0)))
}

export default function PushNotificationSetup() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function enablePush() {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        throw new Error('Kivinjari hiki hakitumii browser push notifications. Tumia toleo jipya la Chrome, Edge, Firefox au Safari inayotumika.')
      }
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BI0OkrwyzQjkekKBtfqw6iy2QgHgtlRlvWvdQi_DFrhdx_cKWe6dwlV2PUfp8HDPoM_eNwc55OsjJj_S-QkeBDU'

      // Websites cannot open the operating system's notification settings directly.
      // Ask via the browser permission prompt; when already blocked, show the site-settings steps.
      if (Notification.permission === 'denied') {
        throw new Error('Arifa zimezuiwa na kivinjari. Fungua Site settings za SmartNekam > Notifications > Allow, kisha rudi hapa na ujaribu tena.')
      }
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
      if (permission !== 'granted') throw new Error('Chagua Allow kwenye dirisha la ruhusa la browser. Kama dirisha halionekani, fungua Site settings > Notifications > Allow.')

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
      if (saveError) throw new Error(`Usajili wa kifaa umeshindikana: ${saveError.message}. Hakikisha umeendesha SQL 033.`)

      setSuccess('Arifa zimewashwa kwenye kifaa hiki. Ili simu na ujumbe zifikie kifaa app ikiwa imefungwa, Supabase Edge Function smartnekam-push na Database Webhook pia lazima ziwe zimewashwa.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Imeshindikana kuwasha push notifications.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="geometric-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <h2 className="font-extrabold text-slate-950 dark:text-white">Washa arifa kwenye kifaa hiki</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Washa ruhusa ya kifaa. Arifa za app iliyofungwa hutegemea pia usanidi wa push kwenye Supabase.</p>
        {success && <p role="status" className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{success}</p>}
        {error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</p>}
      </div>
      <button type="button" onClick={() => void enablePush()} disabled={busy} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
        {busy ? 'Inawasha…' : 'Washa arifa'}
      </button>
    </section>
  )
}
