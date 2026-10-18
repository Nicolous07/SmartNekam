'use client'

import { useEffect, useState } from 'react'
import { Download, Plus, Share2, X } from 'lucide-react'

type InstallChoice = { outcome: 'accepted' | 'dismissed'; platform?: string }
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<InstallChoice>
}

const DISMISS_KEY = 'smartnekam-pwa-install-dismissed-v1'

function isStandaloneApp(): boolean {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true
}

function isAppleMobileDevice(): boolean {
  const userAgent = window.navigator.userAgent.toLowerCase()
  const isIOS = /iphone|ipad|ipod/.test(userAgent)
  // iPadOS may identify itself as a Mac while still exposing touch points.
  const isIPadOS = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1
  return isIOS || isIPadOS
}

export default function SmartNekamInstallPrompt() {
  const [installed, setInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [visible, setVisible] = useState(false)
  const [iosInstructionsOpen, setIOSInstructionsOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const alreadyInstalled = isStandaloneApp()
    const appleMobile = isAppleMobileDevice()
    let dismissed = false

    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      // Storage may be disabled by browser privacy settings; installation still works.
    }

    setInstalled(alreadyInstalled)
    setIsIOS(appleMobile)
    if (!alreadyInstalled && appleMobile && !dismissed) setVisible(true)

    // The existing PushNotificationSetup component owns /sw.js registration for web push.

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
      if (!dismissed && !alreadyInstalled) setVisible(true)
    }

    const handleAppInstalled = () => {
      setInstalled(true)
      setVisible(false)
      setIOSInstructionsOpen(false)
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  function dismissInstallPrompt() {
    setVisible(false)
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // The close action still works when browser storage is unavailable.
    }
  }

  async function startInstall() {
    if (isIOS) {
      setIOSInstructionsOpen(true)
      return
    }

    if (!installPrompt) return
    try {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      if (choice.outcome === 'accepted') setVisible(false)
      setInstallPrompt(null)
    } catch (error) {
      console.warn('[SmartNekam] The browser install prompt did not complete.', error)
    }
  }

  if (installed || !visible || (!isIOS && !installPrompt)) return null

  return (
    <>
      <aside
        aria-label="Sakinisha SmartNekam"
        className="fixed inset-x-3 bottom-24 z-[100] sm:left-auto sm:right-5 sm:w-[340px] md:bottom-5"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 text-slate-900 shadow-xl shadow-slate-950/15 backdrop-blur-xl dark:border-white/10 dark:bg-[#121826]/95 dark:text-white">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Download className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold">Sakinisha SmartNekam</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Fungua kama app kwenye kifaa chako.</p>
          </div>
          <button
            type="button"
            onClick={dismissInstallPrompt}
            aria-label="Ficha ujumbe wa kusakinisha"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void startInstall()}
            className="shrink-0 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            Sakinisha
          </button>
        </div>
      </aside>

      {iosInstructionsOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center"
          role="presentation"
          onClick={() => setIOSInstructionsOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="smartnekam-ios-install-title"
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-white/10 dark:bg-[#121826] dark:text-white sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">SmartNekam PWA</p>
                <h2 id="smartnekam-ios-install-title" className="mt-1 text-lg font-extrabold">Ongeza kwenye Home Screen</h2>
              </div>
              <button
                type="button"
                aria-label="Funga maelekezo"
                onClick={() => setIOSInstructionsOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Kwenye iPhone au iPad, tumia Safari ili SmartNekam ifunguke kama app tofauti.
            </p>

            <ol className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Share2 className="h-4 w-4" aria-hidden="true" /></span>
                <span className="pt-1">Fungua <strong>smartnekam.vercel.app</strong> kwenye Safari, kisha bonyeza <strong>Share</strong>.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Plus className="h-4 w-4" aria-hidden="true" /></span>
                <span className="pt-1">Chagua <strong>Add to Home Screen</strong>. Ikiwa chaguo la <strong>Open as Web App</strong> lipo, liwashe.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Download className="h-4 w-4" aria-hidden="true" /></span>
                <span className="pt-1">Bonyeza <strong>Add</strong>. Ikoni ya SmartNekam itaonekana kwenye Home Screen.</span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setIOSInstructionsOpen(false)}
              className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-700"
            >
              Nimeelewa
            </button>
          </section>
        </div>
      )}
    </>
  )
}
