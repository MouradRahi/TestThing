import Link from 'next/link'
import Image from 'next/image'

type Props = {
  slug: string
  title: string
  price: number
  imageUrl?: string
  imageAlt?: string
  artistName?: string
}

export function ProductCard({ slug, title, price, imageUrl, imageAlt, artistName }: Props) {
  return (
    <Link href={`/product/${slug}`} className="group block">
      <div className="aspect-[3/4] bg-surface overflow-hidden relative border border-border group-hover:border-accent/30 transition-colors duration-300">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={imageAlt || title}
            fill
            className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-xs uppercase tracking-widest">
            No image
          </div>
        )}
      </div>
      <div className="mt-3 space-y-1">
        {artistName && (
          <p className="text-[10px] text-accent uppercase tracking-[0.2em]">{artistName}</p>
        )}
        <p className="text-sm text-foreground leading-snug">{title}</p>
        <p className="text-sm text-muted">${price}</p>
      </div>
    </Link>
  )
}
