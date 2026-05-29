'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'

type Slide = {
  bgImage?: string
  bgColor?: string
  overlayOpacity?: number
  eyebrow?: string
  headline?: string
  subline?: string
  ctaLabel?: string
  ctaHref?: string
}

type Props = {
  slides: Slide[]
  height?: string
  autoplayInterval?: number
}

export function SlideshowSection({ slides, height = '80vh', autoplayInterval = 5000 }: Props) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)

  const next = useCallback(() => setCurrent(i => (i + 1) % slides.length), [slides.length])
  const prev = useCallback(() => setCurrent(i => (i - 1 + slides.length) % slides.length), [slides.length])

  useEffect(() => {
    if (paused || slides.length <= 1 || !autoplayInterval) return
    const id = setInterval(next, autoplayInterval)
    return () => clearInterval(id)
  }, [paused, next, autoplayInterval, slides.length])

  if (!slides.length) return null

  return (
    <div
      className="relative overflow-hidden border-b border-border"
      style={{ height }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((slide, i) => {
        const alpha = ((slide.overlayOpacity ?? 40) / 100).toFixed(2)
        return (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === current ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            style={{ backgroundColor: slide.bgColor || '#0a0a0a' }}
          >
            {slide.bgImage && (
              <Image src={slide.bgImage} alt="" fill className="object-cover" priority={i === 0} />
            )}
            <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${alpha})` }} />

            <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
              {slide.eyebrow && (
                <p className="text-accent text-[10px] uppercase tracking-[0.4em] mb-6">{slide.eyebrow}</p>
              )}
              {slide.headline && (
                <h2 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6 leading-[0.95]">
                  {slide.headline}
                </h2>
              )}
              {slide.subline && (
                <p className="text-muted text-base max-w-sm mb-12">{slide.subline}</p>
              )}
              {slide.ctaLabel && slide.ctaHref && (
                <Button href={slide.ctaHref}>{slide.ctaLabel}</Button>
              )}
            </div>
          </div>
        )
      })}

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === current ? 'bg-accent' : 'bg-foreground/20 hover:bg-foreground/50'
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Arrows */}
      {slides.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center text-foreground/40 hover:text-accent transition-colors text-2xl"
            aria-label="Previous slide"
          >‹</button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center text-foreground/40 hover:text-accent transition-colors text-2xl"
            aria-label="Next slide"
          >›</button>
        </>
      )}
    </div>
  )
}
