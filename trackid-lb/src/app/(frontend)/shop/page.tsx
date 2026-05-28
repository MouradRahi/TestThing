import Link from 'next/link'
import { getPayload } from '@/lib/payload'
import { ProductCard } from '@/components/product/ProductCard'
import { Button } from '@/components/ui/Button'
import type { Where } from 'payload'

export const revalidate = 30

const PAGE_SIZE = 24

type SearchParams = {
  cursor?: string
  artist?: string
  category?: string
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { cursor, artist, category } = await searchParams
  const payload = await getPayload()

  const where: Where = { status: { equals: 'published' } }
  if (artist) where['artist.slug'] = { equals: artist }
  if (category) where['category.slug'] = { equals: category }
  if (cursor) where['createdAt'] = { less_than: cursor }

  const [{ docs: products }, { docs: artists }, { docs: categories }] = await Promise.all([
    payload.find({ collection: 'products', where, limit: PAGE_SIZE, sort: '-createdAt', depth: 1 }),
    payload.find({ collection: 'artists', limit: 50, sort: 'name' }),
    payload.find({ collection: 'categories', limit: 50, sort: 'name' }),
  ])

  const last = products[products.length - 1] as (typeof products)[number] & { createdAt?: string }
  const nextCursor =
    products.length === PAGE_SIZE && last?.createdAt ? last.createdAt : null

  const filterBase = (key: string, val: string) => {
    const params = new URLSearchParams()
    if (key !== 'artist' && artist) params.set('artist', artist)
    if (key !== 'category' && category) params.set('category', category)
    params.set(key, val)
    return `/shop?${params.toString()}`
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">Shop</h1>
        <span className="text-xs text-muted uppercase tracking-widest">
          {products.length === 0 ? 'No pieces' : `${products.length}${nextCursor ? '+' : ''} pieces`}
        </span>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-10 pb-8 border-b border-border">
        <Link
          href="/shop"
          className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] border transition-colors ${
            !artist && !category
              ? 'border-accent text-accent'
              : 'border-border text-muted hover:border-foreground hover:text-foreground'
          }`}
        >
          All
        </Link>

        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={filterBase('category', cat.slug)}
            className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] border transition-colors ${
              category === cat.slug
                ? 'border-accent text-accent'
                : 'border-border text-muted hover:border-foreground hover:text-foreground'
            }`}
          >
            {cat.name}
          </Link>
        ))}

        {artists.length > 0 && (
          <span className="border-r border-border self-stretch mx-1" />
        )}

        {artists.map((art) => (
          <Link
            key={art.id}
            href={filterBase('artist', art.slug)}
            className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] border transition-colors ${
              artist === art.slug
                ? 'border-accent text-accent'
                : 'border-border text-muted hover:border-foreground hover:text-foreground'
            }`}
          >
            {art.name}
          </Link>
        ))}
      </div>

      {/* Grid */}
      {products.length === 0 ? (
        <div className="text-center py-32 text-muted">
          <p className="mb-4">Nothing here yet.</p>
          {(artist || category) && (
            <Link href="/shop" className="text-xs uppercase tracking-widest text-accent hover:text-accent-hover">
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.map((product) => {
            const images = Array.isArray(product.images) ? product.images : []
            const artistObj =
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
                artistName={artistObj?.name}
              />
            )
          })}
        </div>
      )}

      {/* Load more */}
      {nextCursor && (
        <div className="text-center mt-16">
          <Button
            href={`/shop?cursor=${encodeURIComponent(nextCursor)}${artist ? `&artist=${artist}` : ''}${category ? `&category=${category}` : ''}`}
            variant="secondary"
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  )
}
