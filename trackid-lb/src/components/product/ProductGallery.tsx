'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'

export type GalleryImage = { url: string; alt: string }

// Interactive product image gallery: click a thumbnail to swap the main image.
// Alt text is resolved server-side and passed in. E5 (ENHANCEMENTS.md) —
// clicking the main image opens a full-screen lightbox: the hand-painted
// detail is the product, worth letting people see up close. Dependency-free
// (CSS transform + pointer events, no library) — click again to toggle a 2x
// zoom centered on the click point, Esc/backdrop/× closes, arrows step
// through the set when there's more than one image.
export function ProductGallery({ images }: { images: GalleryImage[] }) {
  const [active, setActive] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [origin, setOrigin] = useState('center')

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false)
    setZoomed(false)
  }, [])

  useEffect(() => {
    if (!lightboxOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowRight') setActive((i) => (i + 1) % images.length)
      if (e.key === 'ArrowLeft') setActive((i) => (i - 1 + images.length) % images.length)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [lightboxOpen, closeLightbox, images.length])

  if (images.length === 0) {
    return (
      <div className="aspect-[3/4] bg-surface border border-border flex items-center justify-center text-muted text-xs uppercase tracking-widest">
        No image
      </div>
    )
  }

  const current = images[active] ?? images[0]

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        aria-label={current.alt}
        className="block w-full aspect-[3/4] bg-surface relative overflow-hidden border border-border cursor-zoom-in"
      >
        <Image
          key={current.url}
          src={current.url}
          alt={current.alt}
          fill
          className="object-cover"
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </button>

      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.slice(0, 8).map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1} of ${images.length}`}
              aria-current={i === active}
              className={`aspect-square bg-surface relative overflow-hidden border transition-colors ${
                i === active ? 'border-accent' : 'border-border hover:border-foreground/40'
              }`}
            >
              <Image src={img.url} alt={img.alt} fill className="object-cover" sizes="120px" />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={current.alt}
          className="fixed inset-0 z-[90] bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              closeLightbox()
            }}
            aria-label="Close"
            className="absolute top-4 end-4 text-white/70 hover:text-white p-2 z-10"
          >
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M3 3l12 12M15 3L3 15" />
            </svg>
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setZoomed(false)
                  setActive((i) => (i - 1 + images.length) % images.length)
                }}
                aria-label="Previous image"
                className="absolute start-2 sm:start-6 text-white/70 hover:text-white p-2 z-10"
              >
                <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M11 3L5 9l6 6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setZoomed(false)
                  setActive((i) => (i + 1) % images.length)
                }}
                aria-label="Next image"
                className="absolute end-2 sm:end-6 text-white/70 hover:text-white p-2 z-10"
              >
                <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M7 3l6 6-6 6" />
                </svg>
              </button>
            </>
          )}

          <div
            className="relative w-full h-full max-w-5xl max-h-[85vh] m-6 overflow-hidden"
            onClick={(e) => {
              e.stopPropagation()
              if (!zoomed) {
                const rect = e.currentTarget.getBoundingClientRect()
                const x = ((e.clientX - rect.left) / rect.width) * 100
                const y = ((e.clientY - rect.top) / rect.height) * 100
                setOrigin(`${x}% ${y}%`)
              }
              setZoomed((z) => !z)
            }}
          >
            <Image
              key={current.url}
              src={current.url}
              alt={current.alt}
              fill
              className="object-contain transition-transform duration-300 ease-out cursor-zoom-in"
              style={{ transform: zoomed ? 'scale(2)' : 'scale(1)', transformOrigin: origin }}
              sizes="100vw"
            />
          </div>
        </div>
      )}
    </div>
  )
}
