import { getLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getPayload } from '@/lib/payload'
import { ProductCard } from '@/components/product/ProductCard'
import { totalStock } from '@/lib/stock'
import { resolveAlt } from '@/lib/image'

type Props = {
  sectionTitle?: string
  viewAllLabel?: string
  viewAllHref?: string
  source?: 'latest' | 'manual'
  limit?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products?: any[]
}

export async function FeaturedSection({
  sectionTitle = 'Latest Drops',
  viewAllLabel = 'View all →',
  viewAllHref = '/shop',
  source = 'latest',
  limit = 6,
  products: manualProducts,
}: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let products: any[] = []

  if (source === 'manual' && Array.isArray(manualProducts) && manualProducts.length > 0) {
    products = manualProducts.filter(p => typeof p === 'object' && p !== null && p.slug)
  } else {
    const payload = await getPayload()
    const result = await payload.find({
      collection: 'products',
      where: { status: { equals: 'published' } },
      limit: Math.min(limit || 6, 12),
      sort: '-createdAt',
      depth: 1,
      locale: (await getLocale()) as 'en' | 'ar',
    })
    products = result.docs
  }

  if (!products.length) return null

  return (
    <section className="px-6 py-20 max-w-7xl mx-auto">
      <div className="flex items-baseline justify-between mb-10">
        <h2 className="text-xs uppercase tracking-[0.25em] text-muted">{sectionTitle}</h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-xs uppercase tracking-[0.2em] text-muted hover:text-accent transition-colors">
            {viewAllLabel}
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {products.map((product) => {
          const images = Array.isArray(product.images) ? product.images : []
          const artist = product.artist && typeof product.artist === 'object' ? product.artist : null
          return (
            <ProductCard
              key={product.id}
              slug={product.slug}
              title={product.title}
              price={product.price}
              imageUrl={images[0]?.url}
              imageAlt={resolveAlt(images[0]) || undefined}
              artistName={artist?.name}
              soldOut={totalStock(product) === 0}
            />
          )
        })}
      </div>
    </section>
  )
}
