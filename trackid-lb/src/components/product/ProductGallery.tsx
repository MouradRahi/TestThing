'use client'

import { useState } from 'react'
import Image from 'next/image'

export type GalleryImage = { url: string; alt: string }

// Interactive product image gallery: click a thumbnail to swap the main image.
// Alt text is resolved server-side and passed in.
export function ProductGallery({ images }: { images: GalleryImage[] }) {
  const [active, setActive] = useState(0)

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
      <div className="aspect-[3/4] bg-surface relative overflow-hidden border border-border">
        <Image
          key={current.url}
          src={current.url}
          alt={current.alt}
          fill
          className="object-cover"
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>

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
    </div>
  )
}
