'use client'

import { useEffect, useRef, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'

type Props = {
  resourceId: string
  title: string
  fileType: string
  signedUrl: string | null
}

const IMAGE_TYPES = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

/**
 * In-app study reader. PDFs use the browser's built-in PDF viewer, so native
 * text search, page navigation and accessibility remain available. Signed
 * Storage URLs are short-lived and are only created on the server after RLS.
 */
export default function SmartNekamResourceReader({ resourceId, title, fileType, signedUrl }: Props) {
  const normalizedType = fileType.toLowerCase().replace(/^\./, '')
  const isPdf = normalizedType === 'pdf'
  const isImage = IMAGE_TYPES.has(normalizedType)
  const readerRef = useRef<HTMLElement | null>(null)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(100)
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(`smartnekam:reader:${resourceId}:page`))
      if (Number.isInteger(saved) && saved > 0) setPage(saved)
    } catch {
      // Reading still works when browser storage is disabled.
    } finally {
      setRestored(true)
    }
  }, [resourceId])

  useEffect(() => {
    if (!restored) return
    try {
      window.localStorage.setItem(`smartnekam:reader:${resourceId}:page`, String(page))
    } catch {
      // Do not block a reading session if local storage is full or disabled.
    }
  }, [page, resourceId, restored])

  if (!signedUrl) {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
      Faili halijaweza kufunguliwa kwa usalama kwa sasa. Hakikisha nyenzo imeidhinishwa au jaribu kuingia tena, kisha fungua ukurasa huu upya.
    </div>
  }

  if (!isPdf && !isImage) {
    return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><BookOpen className="h-5 w-5" /></span>
        <div>
          <h2 className="font-extrabold text-slate-950 dark:text-white">Reader ya aina hii inaboreshwa</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">Faili la {normalizedType.toUpperCase()} limehifadhiwa salama, lakini haliwezi kuonyeshwa ndani ya reader hii kwa sasa. Kwa nyenzo zilizoidhinishwa, tumia kitufe cha <strong>Pakua nyenzo</strong> kilicho chini ili kulifungua kwenye programu inayounga mkono aina hiyo.</p>
        </div>
      </div>
    </div>
  }

  function openFullscreen() {
    const node = readerRef.current
    if (!node) return
    if (node.requestFullscreen) void node.requestFullscreen().catch(() => undefined)
  }

  function changePage(nextPage: number) {
    if (!Number.isFinite(nextPage)) return
    setPage(Math.max(1, Math.floor(nextPage)))
  }

  return <section ref={readerRef} className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><BookOpen className="h-4 w-4" /></span>
        <div className="min-w-0"><h2 className="truncate text-sm font-extrabold text-slate-950 dark:text-white">Soma ndani ya SmartNekam</h2><p className="text-xs text-slate-500">{isPdf ? 'PDF Reader' : 'Image Reader'} · Maendeleo ya kusoma huhifadhiwa kwenye kifaa hiki</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {isPdf && <>
          <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
            <button type="button" aria-label="Ukurasa uliotangulia" title="Ukurasa uliotangulia" onClick={() => changePage(page - 1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft className="h-4 w-4" /></button>
            <label className="flex items-center gap-1 px-1 text-xs text-slate-600 dark:text-slate-300"><span>Ukurasa</span><input aria-label="Namba ya ukurasa" type="number" min={1} value={page} onChange={(event) => changePage(Number(event.target.value))} className="w-12 bg-transparent py-1 text-center font-bold text-slate-900 outline-none dark:text-white" /></label>
            <button type="button" aria-label="Ukurasa unaofuata" title="Ukurasa unaofuata" onClick={() => changePage(page + 1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
            <button type="button" aria-label="Punguza ukubwa" title="Punguza ukubwa" onClick={() => setZoom((value) => Math.max(60, value - 10))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><ZoomOut className="h-4 w-4" /></button>
            <span className="min-w-12 text-center text-xs font-bold text-slate-700 dark:text-slate-200">{zoom}%</span>
            <button type="button" aria-label="Ongeza ukubwa" title="Ongeza ukubwa" onClick={() => setZoom((value) => Math.min(180, value + 10))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><ZoomIn className="h-4 w-4" /></button>
          </div>
          <button type="button" onClick={() => { setPage(1); setZoom(100) }} title="Rudisha mipangilio" aria-label="Rudisha mipangilio" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"><RotateCcw className="h-4 w-4" /></button>
        </>}
        <button type="button" onClick={openFullscreen} title="Fungua reader kwa skrini nzima" aria-label="Fungua reader kwa skrini nzima" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"><Maximize2 className="h-4 w-4" /></button>
      </div>
    </div>
    {isPdf ? <iframe title={`Reader: ${title}`} src={`${signedUrl}#toolbar=1&navpanes=0&view=FitH&page=${page}&zoom=${zoom}`} className="block h-[72svh] min-h-[360px] max-h-[calc(100svh-150px)] w-full touch-pan-y overscroll-y-contain bg-slate-200 sm:h-[78vh] sm:min-h-[520px]" style={{ touchAction: 'pan-y pinch-zoom' }} allow="fullscreen" /> : <div className="max-h-[78svh] overflow-auto overscroll-contain touch-pan-x touch-pan-y scroll-smooth bg-slate-100 p-3 text-center [-webkit-overflow-scrolling:touch] dark:bg-slate-900 sm:max-h-[82vh] sm:p-6"><img src={signedUrl} alt={title} draggable={false} style={{ width: `${zoom}%`, maxWidth: 'none', touchAction: 'pan-x pan-y pinch-zoom' }} className="mx-auto h-auto rounded shadow-md" /><div className="mt-3 flex justify-center gap-2"><button type="button" onClick={() => setZoom((value) => Math.max(40, value - 10))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-950">−</button><span className="self-center text-xs font-bold">{zoom}%</span><button type="button" onClick={() => setZoom((value) => Math.min(200, value + 10))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-950">+</button></div></div>}
    <p className="border-t border-slate-200 px-3 py-2 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">Kidokezo: PDF inaunga mkono utafutaji wa maandishi kupitia toolbar ya PDF ya kivinjari. Ukurasa wa mwisho unawekwa kwenye kifaa hiki; futa data ya browser ukitaka kuanza upya.</p>
  </section>
}
