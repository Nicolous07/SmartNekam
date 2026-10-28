'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

type ImageLightboxProps = {
  src: string
  alt: string
  children: ReactNode
  className?: string
  triggerLabel?: string
}

/** Clickable image that opens a full-size, accessible overlay without leaving the current page. */
export default function ImageLightbox({
  src,
  alt,
  children,
  className = '',
  triggerLabel,
}: ImageLightboxProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={triggerLabel || `Fungua picha kubwa: ${alt}`}
        className={className}
      >
        {children}
      </button>
      {mounted && open && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt || 'Picha kubwa'}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 p-3 sm:p-6"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Funga picha kubwa"
            className="fixed right-3 top-3 z-[1001] flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-lg backdrop-blur hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-5 sm:top-5"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={src}
            alt={alt}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90dvh] max-w-[96vw] select-none object-contain"
            draggable={false}
          />
        </div>,
        document.body,
      )}
    </>
  )
}
