import { Link } from '@/i18n/navigation'
import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { getPayload } from '@/lib/payload'
import { ProductCard } from '@/components/product/ProductCard'
import { Button } from '@/components/ui/Button'
import { totalStock } from '@/lib/stock'
import { resolveAlt } from '@/lib/image'
import { routing } from '@/i18n/routing'
import type { Where } from 'payload'

// Filter/search/sort variants all point back to the base shop URL for SEO.
export const metadata: Metadata = {
  alternates: { canonical: '/shop' },
}

// /shop reads searchParams (filters, search, sort, cursor) so it renders
// dynamically per request — there's no static page to revalidate. Stock/price
// freshness is handled by the product revalidation hooks, not an ISR window here.
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 24

type SortKey = 'newest' | 'price-asc' | 'price-desc'

// Labels come from the `shop.sort*` message keys so they localize
const SORT_OPTIONS: Array<{ key: SortKey; labelKey: 'sortNewest' | 'sortPriceAsc' | 'sortPriceDesc'; sort: string }> = [
  { key: 'newest', labelKey: 'sortNewest', sort: '-createdAt' },
  { key: 'price-asc', labelKey: 'sortPriceAsc', sort: 'price' },
  { key: 'price-desc', labelKey: 'sortPriceDesc', sort: '-price' },
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
  const locale = (await getLocale()) as 'en' | 'ar'
  const t = await getTranslations('shop')

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

  const [{ docs: products, totalDocs }, { docs: artists }, { docs: categories }] = await Promise.all([
    payload.find({
      collection: 'products',
      where,
      limit: cursorable ? PAGE_SIZE : 60,
      sort,
      depth: 1,
      locale,
    }),
    payload.find({ collection: 'artists', limit: 50, sort: 'name', locale }),
    payload.find({ collection: 'categories', limit: 50, sort: 'name', locale }),
  ])

  const last = products[products.length - 1] as (typeof products)[number] & { createdAt?: string }
  const nextCursor =
    cursorable && products.length === PAGE_SIZE && last?.createdAt ? last.createdAt : null

  // A plain GET form submits to its literal action — it must carry the locale
  // prefix itself (i18n Links handle this automatically, raw actions don't).
  const searchAction = locale === routing.defaultLocale ? '/shop' : `/${locale}/shop`

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
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <span className="text-xs text-muted uppercase tracking-widest">
          {totalDocs === 0 ? t('noPieces') : t('pieceCount', { count: totalDocs })}
        </span>
      </div>

      {/* Search + sort */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <form action={searchAction} className="flex-1 flex gap-2">
          {artist && <input type="hidden" name="artist" value={artist} />}
          {category && <input type="hidden" name="category" value={category} />}
          {sortKey !== 'newest' && <input type="hidden" name="sort" value={sortKey} />}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder={t('searchPlaceholder')}
            className="flex-1 max-w-sm bg-surface border border-border text-foreground px-3 py-2 text-sm placeholder:text-muted/40 focus:border-accent/70 outline-none transition-colors"
          />
          <button
            type="submit"
            className="px-4 py-2 border border-border text-[10px] uppercase tracking-[0.2em] text-muted hover:border-foreground hover:text-foreground transition-colors"
          >
            {t('search')}
          </button>
        </form>

        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted me-1">{t('sort')}</span>
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
              {t(opt.labelKey)}
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
          {t('all')}
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
          <p className="mb-4">{q ? t('nothingFound', { query: q }) : t('nothingYet')}</p>
          {(artist || category || q) && (
            <Link href="/shop" className="text-xs uppercase tracking-widest text-accent hover:text-accent-hover">
              {t('clearFilters')}
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
                imageUrl={images[0]?.url ?? undefined}
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
              {t('firstPage')}
            </Button>
          )}
          {nextCursor && (
            <Button href={shopUrl({ cursor: nextCursor })} variant="secondary">
              {t('nextPage')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
