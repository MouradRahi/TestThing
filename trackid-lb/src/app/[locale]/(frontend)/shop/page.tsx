import { Link } from '@/i18n/navigation'
import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { getPayload } from '@/lib/payload'
import { ProductCard } from '@/components/product/ProductCard'
import { Button } from '@/components/ui/Button'
import { totalStock } from '@/lib/stock'
import { resolveAlt } from '@/lib/image'
import { getSiteSettings, resolveCurrencyDisplay } from '@/lib/site-settings'
import { routing } from '@/i18n/routing'
import { localizedAlternates } from '@/lib/seo'
import type { Where, WhereField } from 'payload'

// Filter/search/sort variants all point back to the base shop URL for SEO.
// A locale-aware function (not a static object) — the canonical must be
// /shop on the English site but /ar/shop on the Arabic one (BUGS.md B9).
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return { alternates: localizedAlternates('/shop', locale) }
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
  garmentType?: string
  q?: string
  sort?: string
  inStock?: string
  price?: string
}

// Fixed bands (E6, ENHANCEMENTS.md) — RSC-friendly, zero JS, avoids a slider.
const PRICE_BANDS: Array<{ key: string; max?: number; min?: number }> = [
  { key: 'under25', max: 25 },
  { key: '25to50', min: 25, max: 50 },
  { key: '50to100', min: 50, max: 100 },
  { key: 'over100', min: 100 },
]

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { cursor, artist, category, garmentType, q, sort: sortParam, inStock, price } = await searchParams
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

  const priceBand = PRICE_BANDS.find((b) => b.key === price)

  // and[] rather than a single flat object — both search (q) and the
  // in-stock toggle need their own `or` block, and Payload's Where type only
  // allows one top-level `or` key per object.
  const and: Where[] = [{ status: { equals: 'published' } }]
  if (artist) and.push({ 'artist.slug': { equals: artist } })
  if (category) and.push({ 'category.slug': { equals: category } })
  if (garmentType) and.push({ 'garmentType.slug': { equals: garmentType } })
  if (q) and.push({ or: [{ title: { like: q } }, { 'tags.tag': { like: q } }] })
  if (cursorable && cursor) and.push({ createdAt: { less_than: cursor } })
  if (inStock === '1') {
    // Mirrors totalStock()'s semantics exactly: sum of sizes' stock (if any
    // size has stock > 0, the sum is > 0) or the flat quantity otherwise.
    and.push({ or: [{ stockQuantity: { greater_than: 0 } }, { 'sizes.stockQuantity': { greater_than: 0 } }] })
  }
  if (priceBand) {
    const priceWhere: WhereField = {}
    if (priceBand.min != null) priceWhere.greater_than_equal = priceBand.min
    if (priceBand.max != null) priceWhere.less_than_equal = priceBand.max
    and.push({ price: priceWhere })
  }
  const where: Where = { and }

  const [{ docs: products, totalDocs }, { docs: artists }, { docs: categories }, { docs: garmentTypes }, settings] = await Promise.all([
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
    payload.find({ collection: 'garment-types', limit: 50, sort: 'name', locale }),
    getSiteSettings(locale),
  ])
  const currency = resolveCurrencyDisplay(settings)

  const last = products[products.length - 1] as (typeof products)[number] & { createdAt?: string }
  const nextCursor =
    cursorable && products.length === PAGE_SIZE && last?.createdAt ? last.createdAt : null

  // A plain GET form submits to its literal action — it must carry the locale
  // prefix itself (i18n Links handle this automatically, raw actions don't).
  const searchAction = locale === routing.defaultLocale ? '/shop' : `/${locale}/shop`

  // Build a /shop URL preserving the other active params
  const shopUrl = (overrides: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = {
      artist,
      category,
      garmentType,
      q,
      inStock,
      price,
      sort: sortKey === 'newest' ? undefined : sortKey,
      ...overrides,
    }
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
      <div className="flex flex-wrap gap-2 mb-4 pb-8 border-b border-border">
        <Link
          href={shopUrl({ artist: undefined, category: undefined, garmentType: undefined, cursor: undefined })}
          className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] border transition-colors ${
            !artist && !category && !garmentType
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

        {garmentTypes.length > 0 && (
          <span className="border-r border-border self-stretch mx-1" aria-hidden="true" />
        )}

        {garmentTypes.map((gt) => (
          <Link
            key={gt.id}
            href={shopUrl({ garmentType: gt.slug, cursor: undefined })}
            className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] border transition-colors ${
              garmentType === gt.slug
                ? 'border-accent text-accent'
                : 'border-border text-muted hover:border-foreground hover:text-foreground'
            }`}
          >
            {gt.name}
          </Link>
        ))}

        {artists.length > 0 && (
          <span className="border-r border-border self-stretch mx-1" aria-hidden="true" />
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

      {/* Attribute filters: price bands + in-stock toggle */}
      <div className="flex flex-wrap items-center gap-2 mb-10 pb-8 border-b border-border">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted me-1">{t('priceLabel')}</span>
        <Link
          href={shopUrl({ price: undefined, cursor: undefined })}
          className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] border transition-colors ${
            !priceBand
              ? 'border-accent text-accent'
              : 'border-border text-muted hover:border-foreground hover:text-foreground'
          }`}
        >
          {t('anyPrice')}
        </Link>
        {PRICE_BANDS.map((band) => (
          <Link
            key={band.key}
            href={shopUrl({ price: band.key, cursor: undefined })}
            className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] border transition-colors ${
              price === band.key
                ? 'border-accent text-accent'
                : 'border-border text-muted hover:border-foreground hover:text-foreground'
            }`}
          >
            {t(`priceBands.${band.key}` as 'priceBands.under25')}
          </Link>
        ))}

        <span className="border-r border-border self-stretch mx-1" aria-hidden="true" />

        <Link
          href={shopUrl({ inStock: inStock === '1' ? undefined : '1', cursor: undefined })}
          aria-pressed={inStock === '1'}
          className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] border transition-colors ${
            inStock === '1'
              ? 'border-accent text-accent'
              : 'border-border text-muted hover:border-foreground hover:text-foreground'
          }`}
        >
          {t('inStockOnly')}
        </Link>
      </div>

      {/* Grid */}
      {products.length === 0 ? (
        <div className="text-center py-32 text-muted">
          <p className="mb-4">{q ? t('nothingFound', { query: q }) : t('nothingYet')}</p>
          {(artist || category || garmentType || q || inStock || price) && (
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
                currency={currency}
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
