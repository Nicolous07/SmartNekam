'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Loader2 } from 'lucide-react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { createClient } from '@/lib/supabase/client'

// ---------- Ukurasa mmoja (unachorwa tu ukikaribia skrini) ----------
function PdfPage({
  pdf,
  n,
  width,
  ratio,
  onActive,
}: {
  pdf: PDFDocumentProxy
  n: number
  width: number
  ratio: number
  onActive: (n: number) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const nearObs = new IntersectionObserver(([e]) => setNear(e.isIntersecting), {
      rootMargin: '900px 0px',
    })
    // Ukurasa unaopita kwenye mstari mwembamba katikati ya skrini ndio "ukurasa wa sasa"
    const activeObs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) onActive(n)
      },
      { rootMargin: '-45% 0px -45% 0px' }
    )
    nearObs.observe(el)
    activeObs.observe(el)
    return () => {
      nearObs.disconnect()
      activeObs.disconnect()
    }
  }, [n, onActive])

  useEffect(() => {
    if (!near || !width) return
    let cancelled = false
    let task: RenderTask | null = null
    ;(async () => {
      try {
        const page = await pdf.getPage(n)
        const base = page.getViewport({ scale: 1 })
        const fit = width / base.width
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const vp = page.getViewport({ scale: fit * dpr })
        const canvas = canvasRef.current
        if (!canvas || cancelled) return
        canvas.width = vp.width
        canvas.height = vp.height
        canvas.style.width = `${width}px`
        canvas.style.height = `${(width * vp.height) / vp.width}px`
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        task = page.render({ canvasContext: ctx, canvas, viewport: vp })
        await task.promise
      } catch {
        // kuchora kumekatizwa (mf. mtumiaji amesogeza haraka) — si tatizo
      }
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [near, width, pdf, n])

  return (
    <div
      ref={boxRef}
      id={`pdf-page-${n}`}
      className="mx-auto overflow-hidden rounded-lg bg-white shadow-md"
      style={{ width, height: width * ratio }}
    >
      <canvas ref={canvasRef} />
    </div>
  )
}

// ---------- Msomaji mkuu ----------
export default function PdfReader({
  url,
  itemId,
  userId,
  startPage,
  savedTotal,
}: {
  url: string
  itemId: string
  userId: string
  startPage: number
  savedTotal: number
}) {
  const supabase = useMemo(() => createClient(), [])
  const wrapRef = useRef<HTMLDivElement>(null)
  const restoredRef = useRef(startPage <= 1)

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(savedTotal)
  const [ratio, setRatio] = useState(1.414)
  const [width, setWidth] = useState(0)
  const [current, setCurrent] = useState(startPage)
  const [error, setError] = useState('')

  // Pakia PDF
  useEffect(() => {
    let cancelled = false
    let doc: PDFDocumentProxy | null = null
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString()
        doc = await pdfjs.getDocument({ url }).promise
        if (cancelled) {
          void doc.destroy()
          return
        }
        const first = await doc.getPage(1)
        const vp = first.getViewport({ scale: 1 })
        setRatio(vp.height / vp.width)
        setNumPages(doc.numPages)
        setPdf(doc)
      } catch {
        if (!cancelled) setError('Imeshindikana kufungua faili. Jaribu tena baadaye.')
      }
    })()
    return () => {
      cancelled = true
      void doc?.destroy()
    }
  }, [url])

  // Pima upana wa eneo la kusomea
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Resume Reading: ruka hadi ukurasa alioishia
  useEffect(() => {
    if (!pdf || !width || restoredRef.current) return
    const t = setTimeout(() => {
      document.getElementById(`pdf-page-${startPage}`)?.scrollIntoView({ block: 'start' })
      restoredRef.current = true
    }, 50)
    return () => clearTimeout(t)
  }, [pdf, width, startPage])

  // Hifadhi maendeleo (baada ya kusimama sekunde ~1.2)
  useEffect(() => {
    if (!pdf || !numPages) return
    const t = setTimeout(() => {
      void supabase.from('user_reading_progress').upsert(
        {
          user_id: userId,
          item_id: itemId,
          last_page: Math.min(Math.max(current, 1), numPages),
          total_pages: numPages,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,item_id' }
      )
    }, 1200)
    return () => clearTimeout(t)
  }, [current, numPages, pdf, supabase, userId, itemId])

  const onActive = useMemo(
    () => (n: number) => {
      if (restoredRef.current) setCurrent(n)
    },
    []
  )

  const pct = numPages ? Math.min(100, Math.round((current / numPages) * 100)) : 0

  return (
    <div>
      {/* Mstari wa maendeleo (unabaki juu ukisogeza) */}
      <div className="sticky top-12 z-30 -mx-1 mb-3 rounded-xl border border-emerald-100 bg-white/95 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="flex flex-wrap items-center justify-between gap-x-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
            Umesoma: {pct}% · Imebaki: {100 - pct}%
          </span>
          {numPages > 0 && (
            <span>
              Ukurasa {current} kati ya {numPages}
            </span>
          )}
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div ref={wrapRef} className="w-full">
        {error && (
          <p className="geometric-card p-4 text-sm text-red-600">{error}</p>
        )}
        {!pdf && !error && (
          <div className="geometric-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Inapakia...
          </div>
        )}
        {pdf && width > 0 && (
          <div className="space-y-4">
            {Array.from({ length: numPages }, (_, i) => (
              <PdfPage key={i + 1} pdf={pdf} n={i + 1} width={width} ratio={ratio} onActive={onActive} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
