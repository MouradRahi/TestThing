import Image from 'next/image'
import { Button } from '@/components/ui/Button'

type Props = {
  image?: string
  imageAlt?: string
  eyebrow?: string
  heading?: string
  body?: string
  ctaLabel?: string
  ctaHref?: string
  imagePosition?: 'left' | 'right'
}

export function ImageTextSection({
  image = '', imageAlt, eyebrow, heading, body,
  ctaLabel, ctaHref,
  imagePosition = 'left',
}: Props) {
  if (!image) return null
  const imageCol = imagePosition === 'right' ? 'md:order-2' : 'md:order-1'
  const textCol  = imagePosition === 'right' ? 'md:order-1' : 'md:order-2'

  return (
    <section className="border-t border-border">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2">
        {/* Image */}
        <div className={`relative aspect-[4/3] md:aspect-auto md:min-h-[480px] bg-surface ${imageCol}`}>
          <Image
            src={image}
            alt={imageAlt || heading || ''}
            fill
            className="object-cover"
            sizes="(min-width: 768px) 50vw, 100vw"
          />
        </div>

        {/* Text */}
        <div className={`flex flex-col justify-center px-8 md:px-14 py-16 ${textCol}`}>
          {eyebrow && (
            <p className="text-accent text-[10px] uppercase tracking-[0.4em] mb-4">{eyebrow}</p>
          )}
          {heading && (
            <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight mb-4">
              {heading}
            </h2>
          )}
          {body && (
            <p className="text-muted text-sm leading-relaxed mb-8 max-w-sm">{body}</p>
          )}
          {ctaLabel && ctaHref && (
            <Button href={ctaHref} size="md" className="self-start">{ctaLabel}</Button>
          )}
        </div>
      </div>
    </section>
  )
}
