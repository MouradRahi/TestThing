import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { formatPrice } from '@/lib/format'

type Props = {
  slug: string
  title: string
  price: number
  imageUrl?: string
  imageAlt?: string
  artistName?: string
  soldOut?: boolean
}

export async function ProductCard({ slug, title, price, imageUrl, imageAlt, artistName, soldOut }: Props) {
  const t = await getTranslations('product')
  return (
    <Link href={`/product/${slug}`} className="group block">
      <div className="aspect-[3/4] bg-surface overflow-hidden relative border border-border group-hover:border-accent/30 transition-colors duration-300">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={imageAlt || title || ''}
            fill
            className={`object-cover group-hover:scale-[1.03] transition-transform duration-500 ${soldOut ? 'opacity-50' : ''}`}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-xs uppercase tracking-widest">
            {t('noImage')}
          </div>
        )}
        {soldOut && (
          <span className="absolute top-2 start-2 bg-bg/90 border border-border text-muted text-[10px] uppercase tracking-[0.2em] px-2 py-1">
            {t('soldOut')}
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1">
        {artistName && (
          <p className="text-[10px] text-accent uppercase tracking-[0.2em]">{artistName}</p>
        )}
        <p className="text-sm text-foreground leading-snug">{title}</p>
        <p className="text-sm text-muted">{formatPrice(price)}</p>
      </div>
    </Link>
  )
}
