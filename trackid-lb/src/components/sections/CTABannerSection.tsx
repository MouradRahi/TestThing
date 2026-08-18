import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { safeHref } from '@/lib/sanitize'

type Props = {
  headline?: string
  subline?: string
  ctaLabel?: string
  ctaHref?: string
  bgImage?: string
  bgColor?: string
  overlayOpacity?: number
  textColor?: string
}

export function CTABannerSection({
  headline, subline, ctaLabel, ctaHref,
  bgImage, bgColor,
  overlayOpacity = 0,
  textColor,
}: Props) {
  return (
    <section
      className="relative border-t border-border overflow-hidden px-6 py-20 text-center"
      style={{ backgroundColor: bgColor || 'var(--color-accent)' }}
    >
      {bgImage && (
        <Image src={bgImage} alt="" fill className="object-cover" sizes="100vw" />
      )}
      {(bgImage && overlayOpacity > 0) && (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `rgba(0,0,0,${(overlayOpacity / 100).toFixed(2)})` }}
        />
      )}

      <div className="relative z-10" style={textColor ? { color: textColor } : undefined}>
        {headline && (
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight mb-4 text-on-accent">
            {headline}
          </h2>
        )}
        {subline && (
          <p className="text-sm mb-8 max-w-sm mx-auto text-on-accent opacity-70">{subline}</p>
        )}
        {ctaLabel && ctaHref && (
          <Button href={safeHref(ctaHref)} variant="secondary">{ctaLabel}</Button>
        )}
      </div>
    </section>
  )
}
