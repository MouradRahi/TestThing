import Link from 'next/link'
import { getPayload } from '@/lib/payload'
import { ProductCard } from '@/components/product/ProductCard'

export const revalidate = 60

export default async function HomePage() {
  const payload = await getPayload()

  const { docs: featuredProducts } = await payload.find({
    collection: 'products',
    where: { status: { equals: 'published' } },
    limit: 6,
    sort: '-createdAt',
    depth: 1,
  })

  return (
    <>
      {/* Hero */}
      <section className="min-h-[80vh] flex flex-col items-center justify-center text-center px-6 py-24 border-b border-border">
        <p className="text-accent text-[10px] uppercase tracking-[0.4em] mb-6">
          Lebanon · Hand-painted
        </p>
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-foreground mb-6 leading-[0.95]">
          Wear the music<br />you love.
        </h1>
        <p className="text-muted text-base max-w-sm mb-12">
          One-of-a-kind pieces for the artists you can't stop listening to.
        </p>
        <Link
          href="/shop"
          className="inline-block px-10 py-3.5 text-xs uppercase tracking-[0.25em] bg-accent text-bg font-semibold hover:bg-accent-hover transition-colors"
        >
          Shop Now
        </Link>
      </section>

      {/* Latest drops */}
      {featuredProducts.length > 0 && (
        <section className="px-6 py-20 max-w-7xl mx-auto">
          <div className="flex items-baseline justify-between mb-10">
            <h2 className="text-xs uppercase tracking-[0.25em] text-muted">Latest Drops</h2>
            <Link
              href="/shop"
              className="text-xs uppercase tracking-[0.2em] text-muted hover:text-accent transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {featuredProducts.map((product) => {
              const images = Array.isArray(product.images) ? product.images : []
              const artist =
                product.artist && typeof product.artist === 'object' && 'name' in product.artist
                  ? product.artist
                  : null
              return (
                <ProductCard
                  key={product.id}
                  slug={product.slug}
                  title={product.title}
                  price={product.price}
                  imageUrl={images[0]?.url}
                  imageAlt={images[0]?.alt ?? undefined}
                  artistName={artist?.name}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* Brand statement */}
      <section className="border-t border-border px-6 py-20 text-center">
        <p className="text-muted text-sm max-w-lg mx-auto leading-relaxed">
          Every piece is painted by hand in Beirut. No two are alike. When it's gone, it's gone.
        </p>
      </section>
    </>
  )
}
