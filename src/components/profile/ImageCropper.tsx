'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Loader2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'

type Props = {
  file: File
  aspect: number // upana / urefu (1 = mraba, 3 = cover pana)
  shape?: 'round' | 'rect'
  outputWidth: number // upana wa picha ya mwisho kwa pixels
  title: string
  onCancel: () => void
  onDone: (file: File) => void
}

/**
 * Kifaa cha kukata picha (crop): buruta kupanga, slider/wheel kubadilisha ukubwa.
 * Hakitumii package ya nje.
 */
export default function ImageCropper({
  file,
  aspect,
  shape = 'rect',
  outputWidth,
  title,
  onCancel,
  onDone,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const drag = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null)

  const [src, setSrc] = useState<string | null>(null)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Pima ukubwa wa fremu
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Wheel ya mouse = zoom
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom((z) => Math.min(4, Math.max(1, z - e.deltaY * 0.002)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const baseScale = nat && box.w ? Math.max(box.w / nat.w, box.h / nat.h) : 1
  const scale = baseScale * zoom

  function clamp(o: { x: number; y: number }) {
    if (!nat) return o
    const maxX = Math.max(0, (nat.w * scale - box.w) / 2)
    const maxY = Math.max(0, (nat.h * scale - box.h) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, o.x)),
      y: Math.min(maxY, Math.max(-maxY, o.y)),
    }
  }
  const off = clamp(offset)

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startX: e.clientX, startY: e.clientY, ox: off.x, oy: off.y }
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    setOffset(clamp({ x: d.ox + (e.clientX - d.startX), y: d.oy + (e.clientY - d.startY) }))
  }
  function endDrag() {
    drag.current = null
  }

  function reset() {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  function handleDone() {
    const img = imgRef.current
    if (!img || !nat || !box.w) return
    setBusy(true)
    setError('')

    // Eneo la picha asili linaloonekana ndani ya fremu
    const sw = box.w / scale
    const sh = box.h / scale
    const cx = nat.w / 2 - off.x / scale
    const cy = nat.h / 2 - off.y / scale
    const sx = cx - sw / 2
    const sy = cy - sh / 2

    const outW = outputWidth
    const outH = Math.round(outputWidth / aspect)
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setError('Kivinjari chako hakiwezi kukata picha.')
      setBusy(false)
      return
    }
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, outW, outH)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('Imeshindikana kukata picha. Jaribu picha nyingine.')
          setBusy(false)
          return
        }
        const name = shape === 'round' ? 'avatar.jpg' : 'cover.jpg'
        onDone(new File([blob], name, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.9
    )
  }

  const modal = (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="anim-fade-in absolute inset-0 bg-black/70" onClick={busy ? undefined : onCancel} />

      <div className="geometric-card anim-sheet-up relative z-10 w-full max-w-lg overflow-hidden rounded-b-none sm:rounded-b-2xl">
        <div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3 dark:border-slate-800">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Funga"
            className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {/* Fremu ya kukata */}
          <div
            ref={frameRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{ aspectRatio: String(aspect), touchAction: 'none' }}
            className={`relative w-full cursor-grab touch-none select-none overflow-hidden rounded-xl bg-slate-900 active:cursor-grabbing ${
              shape === 'round' ? 'mx-auto max-w-[300px]' : ''
            }`}
          >
            {src && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={src}
                alt=""
                draggable={false}
                onLoad={(e) =>
                  setNat({
                    w: e.currentTarget.naturalWidth,
                    h: e.currentTarget.naturalHeight,
                  })
                }
                className="pointer-events-none select-none"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  maxWidth: 'none',
                  width: nat ? nat.w * scale : 'auto',
                  height: nat ? nat.h * scale : 'auto',
                  opacity: nat ? 1 : 0,
                  transform: `translate(-50%, -50%) translate(${off.x}px, ${off.y}px)`,
                }}
              />
            )}
            {!nat && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            {/* Kinyago kinachoonyesha eneo litakalohifadhiwa */}
            <div
              className={`pointer-events-none absolute inset-0 ring-2 ring-white/80 ${
                shape === 'round'
                  ? 'rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]'
                  : 'rounded-xl'
              }`}
            />
          </div>

          {/* Ukubwa (zoom) */}
          <div className="flex items-center gap-3">
            <ZoomOut className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="Ukubwa wa picha"
              className="h-2 w-full cursor-pointer accent-emerald-600"
            />
            <ZoomIn className="h-4 w-4 shrink-0 text-slate-400" />
            <button
              type="button"
              onClick={reset}
              aria-label="Rudisha"
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 active:scale-90 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Buruta picha kuipanga. Tumia slider (au wheel ya mouse) kubadilisha ukubwa.
          </p>

          {error && (
            <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="flex-1 rounded-xl border-2 border-slate-200 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Ghairi
            </button>
            <button
              type="button"
              onClick={handleDone}
              disabled={busy || !nat}
              className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={3} />}
              Tumia picha hii
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
