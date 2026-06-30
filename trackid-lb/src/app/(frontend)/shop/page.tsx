import Link from 'next/link'
import { getPayload } from '@/lib/payload'
import { ProductCard } from '@/components/product/ProductCard'
import { Button } from '@/components/ui/Button'
import { totalStock } from '@/lib/stock'
import { resolveAlt } from '@/lib/image'
import type { Where } from 'payload'

export const revalidate = 30

const PAGE_SIZE = 24

type SortKey = 'newest' | 'price-asc' | 'price-desc'

const SORT_OPTIONS: Array<{ key: SortKey; label: string; sort: string }> = [
  { key: 'newest', label: 'Newest', sort: '-createdAt' },
  { key: 'price-asc', label: 'Price ↑', sort: 'price' },
  { key: 'price-desc', label: 'Price ↓', sort: '-price' },
]

type SearchParams = {
  cursor?: string
  artist?: string
  category?: string
  q?: string
  sort?: string
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { cursor, artist, category, q, sort: sortParam } = await searchParams
  const payload = await getPayload()

  const sortKey: SortKey = SORT_OPTIONS.some((o) => o.key === sortParam)
    ? (sortParam as SortKey)
    : 'newest'
  const sort = SORT_OPTIONS.find((o) => o.key === sortKey)!.sort
  // The createdAt cursor only works for the newest-first ordering; price sorts
  // show a single larger page instead (fine until the catalog gets very big)
  const cursorable = sortKey === 'newest'

  const where: Where = { status: { equals: 'published' } }
  if (artist) where['artist.slug'] = { equals: artist }
  if (category) where['category.slug'] = { equals: category }
  if (q) where.or = [{ title: { like: q } }, { 'tags.tag': { like: q } }]
  if (cursorable && cursor) where['createdAt'] = { less_than: cursor }

  const [{ docs: products }, { docs: artists }, { docs: categories }] = await Promise.all([
    payload.find({
      collection: 'products',
      where,
      limit: cursorable ? PAGE_SIZE : 60,
      sort,
      depth: 1,
    }),
    payload.find({ collection: 'artists', limit: 50, sort: 'name' }),
    payload.find({ collection: 'categories', limit: 50, sort: 'name' }),
  ])

  const last = products[products.length - 1] as (typeof products)[number] & { createdAt?: string }
  const nextCursor =
    cursorable && products.length === PAGE_SIZE && last?.createdAt ? last.createdAt : null

  // Build a /shop URL preserving the other active params
  const shopUrl = (overrides: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { artist, category, q, sort: sortKey === 'newest' ? undefined : sortKey, ...overrides }
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value)
    }
    const qs = params.toString()
    return qs ? `/shop?${qs}` : '/shop'
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

      {/* Search + sort */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <form action="/shop" className="flex-1 flex gap-2">
          {artist && <input type="hidden" name="artist" value={artist} />}
          {category && <input type="hidden" name="category" value={category} />}
          {sortKey !== 'newest' && <input type="hidden" name="sort" value={sortKey} />}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search pieces…"
            className="flex-1 max-w-sm bg-surface border border-border text-foreground px-3 py-2 text-sm placeholder:text-muted/40 focus:border-accent/70 outline-none transition-colors"
          />
          <button
            type="submit"
            className="px-4 py-2 border border-border text-[10px] uppercase tracking-[0.2em] text-muted hover:border-foreground hover:text-foreground transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted mr-1">Sort</span>
          {SORT_OPTIONS.map((opt) => (
            <Link
              key={opt.key}
              href={shopUrl({ sort: opt.key === 'newest' ? undefined : opt.key, cursor: undefined })}
              className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] border transition-colors ${
                sortKey === opt.key
                  ? 'border-accent text-accent'
                  : 'border-border text-muted hover:border-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-10 pb-8 border-b border-border">
        <Link
          href={shopUrl({ artist: undefined, category: undefined, cursor: undefined })}
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
            href={shopUrl({ category: cat.slug, cursor: undefined })}
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
            href={shopUrl({ artist: art.slug, cursor: undefined })}
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
          <p className="mb-4">{q ? `Nothing found for “${q}”.` : 'Nothing here yet.'}</p>
          {(artist || category || q) && (
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
                imageAlt={resolveAlt(images[0]) || undefined}
                artistName={artistObj?.name}
                soldOut={totalStock(product) === 0}
              />
            )
          })}
        </div>
      )}

      {/* Pagination — cursor-based, so honest Next/First controls (not append) */}
      {(nextCursor || (cursorable && cursor)) && (
        <div className="flex items-center justify-center gap-4 mt-16">
          {cursor && (
            <Button href={shopUrl({ cursor: undefined })} variant="secondary">
              ← First Page
            </Button>
          )}
          {nextCursor && (
            <Button href={shopUrl({ cursor: nextCursor })} variant="secondary">
              Next Page →
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
