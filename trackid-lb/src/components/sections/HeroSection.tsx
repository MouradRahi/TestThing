import Image from 'next/image'
import { Button } from '@/components/ui/Button'

type Props = {
  eyebrow?: string
  headline?: string
  subline?: string
  ctaLabel?: string
  ctaHref?: string
  secondaryCtaLabel?: string
  secondaryCtaHref?: string
  bgImage?: string
  bgColor?: string
  overlayOpacity?: number
  textAlign?: 'left' | 'center' | 'right'
  minHeight?: string
}

const alignMap = {
  left:   'text-left items-start',
  center: 'text-center items-center',
  right:  'text-right items-end',
}

export function HeroSection({
  eyebrow, headline, subline,
  ctaLabel, ctaHref,
  secondaryCtaLabel, secondaryCtaHref,
  bgImage, bgColor,
  overlayOpacity = 0,
  textAlign = 'center',
  minHeight = '80vh',
}: Props) {
  const align = alignMap[textAlign] ?? alignMap.center

  return (
    <section
      className="relative flex flex-col justify-center border-b border-border overflow-hidden px-6 py-24"
      style={{ minHeight, backgroundColor: bgColor || undefined }}
    >
      {bgImage && (
        <Image src={bgImage} alt="" fill className="object-cover" priority />
      )}
      {(bgImage && overlayOpacity > 0) && (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `rgba(0,0,0,${(overlayOpacity / 100).toFixed(2)})` }}
        />
      )}

      <div className={`relative z-10 flex flex-col ${align} max-w-4xl mx-auto w-full`}>
        {eyebrow && (
          <p className="text-accent text-[10px] uppercase tracking-[0.4em] mb-6">{eyebrow}</p>
        )}
        {headline && (
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-foreground mb-6 leading-[0.95]">
            {headline}
          </h1>
        )}
        {subline && (
          <p className="text-muted text-base max-w-sm mb-12">{subline}</p>
        )}
        {(ctaLabel && ctaHref) && (
          <div className="flex flex-wrap gap-4">
            <Button href={ctaHref}>{ctaLabel}</Button>
            {secondaryCtaLabel && secondaryCtaHref && (
              <Button href={secondaryCtaHref} variant="secondary">{secondaryCtaLabel}</Button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
