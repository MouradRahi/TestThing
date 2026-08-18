import { getPayload } from '@/lib/payload'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { AddToCart } from '@/components/product/AddToCart'
import { ProductCard } from '@/components/product/ProductCard'
import { ProductGallery } from '@/components/product/ProductGallery'
import { WishlistButton } from '@/components/account/WishlistButton'
import { RichTextRenderer } from '@/components/RichTextRenderer'
import { WriteReviewForm } from '@/components/product/WriteReviewForm'
import { NotifyMeForm } from '@/components/product/NotifyMeForm'
import { getCustomer } from '@/lib/auth'
import { getSizes, totalStock } from '@/lib/stock'
import { resolveAlt } from '@/lib/image'
import { formatPrice, formatLBP } from '@/lib/format'
import {
  getSiteSettings,
  resolveStoreName,
  resolveProductMetaDescription,
  resolveCurrencyDisplay,
  DEFAULT_PRODUCT_BLURB,
  DEFAULT_PRODUCT_META_TAGLINE,
} from '@/lib/site-settings'
import { localizedAlternates } from '@/lib/seo'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'
import { jsonLdScript } from '@/lib/sanitize'
import { routing } from '@/i18n/routing'

export const revalidate = 3600

export async function generateStaticParams() {
  const payload = await getPayload()
  const { docs } = await payload.find({
    collection: 'products',
    where: { status: { equals: 'published' } },
    limit: 200,
    select: { slug: true },
  })
  return docs.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const payload = await getPayload()
  const { docs } = await payload.find({
    collection: 'products',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
    locale: locale as 'en' | 'ar',
  })
  const product = docs[0]
  if (!product) return {}

  const settings = await getSiteSettings(locale)
  const storeName = resolveStoreName(settings)
  const metaTagline = (settings.productMetaTagline as string) || DEFAULT_PRODUCT_META_TAGLINE

  const images = Array.isArray(product.images) ? product.images : []
  const ogImage = images[0]?.url
  const description = resolveProductMetaDescription(settings, {
    store: storeName,
    title: product.title,
    tagline: metaTagline,
  })

  return {
    title: product.title,
    description,
    alternates: localizedAlternates(`/product/${product.slug}`, locale),
    openGraph: {
      title: product.title,
      description,
      type: 'website',
      ...(ogImage && { images: [{ url: ogImage, alt: product.title }] }),
    },
    twitter: {
      card: 'summary_large_image',
      title: product.title,
      description,
      ...(ogImage && { images: [ogImage] }),
    },
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const payload = await getPayload()

  const [{ docs }, settings, customer] = await Promise.all([
    payload.find({
      collection: 'products',
      where: { slug: { equals: slug }, status: { equals: 'published' } },
      limit: 1,
      depth: 2,
      locale: locale as 'en' | 'ar',
    }),
    getSiteSettings(locale),
    getCustomer(),
  ])

  const product = docs[0]
  if (!product) notFound()

  const t = await getTranslations('product')
  const currency = resolveCurrencyDisplay(settings)
  const storeName = resolveStoreName(settings)
  const productBlurb = (settings.productBlurb as string) || DEFAULT_PRODUCT_BLURB
  const metaTagline = (settings.productMetaTagline as string) || DEFAULT_PRODUCT_META_TAGLINE

  const images = Array.isArray(product.images) ? product.images : []
  const galleryImages = images
    .filter((img): img is typeof img & { url: string } => Boolean(img.url))
    .map((img) => ({ url: img.url, alt: resolveAlt(img) || product.title }))
  const artist =
    product.artist && typeof product.artist === 'object' && 'name' in product.artist
      ? product.artist
      : null
  const category =
    product.category && typeof product.category === 'object' && 'name' in product.category
      ? product.category
      : null

  const sizes = getSizes(product)
  const stock = totalStock(product)
  const specs: Array<{ label: string; value: string }> = Array.isArray(product.specs) ? product.specs : []

  // Reviews (ROADMAP Part 6.2) — published only; rating summary is the
  // denormalized product.ratingAvg/ratingCount, no extra query needed for it.
  const { docs: reviews } = await payload.find({
    collection: 'reviews',
    where: { and: [{ product: { equals: product.id } }, { status: { equals: 'published' } }] },
    sort: '-createdAt',
    limit: 20,
    depth: 0,
  })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: resolveProductMetaDescription(settings, {
      store: storeName,
      title: product.title,
      tagline: metaTagline,
    }),
    brand: { '@type': 'Brand', name: storeName },
    image: images.map((img) => img.url).filter(Boolean),
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'USD',
      availability: stock > 0 || product.preorderEnabled ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: storeName },
    },
    ...(product.ratingCount && product.ratingCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.ratingAvg,
            reviewCount: product.ratingCount,
          },
        }
      : {}),
  }

  const breadcrumbJsonLd = buildBreadcrumbJsonLd(
    [
      { name: t('shop'), path: '/shop' },
      ...(category && 'name' in category && 'slug' in category
        ? [{ name: category.name as string, path: `/shop?category=${category.slug}` }]
        : []),
      { name: product.title },
    ],
    locale,
    routing.defaultLocale,
  )

  // Two related strips: (1) more from the same artist, (2) more of the same
  // garment type. Each is independent and only renders if it has results — so a
  // lone product from an artist never shows another artist's piece under "More from".
  const relatedBase = {
    status: { equals: 'published' as const },
    slug: { not_equals: product.slug },
  }

  let sameArtist: typeof docs = []
  if (artist && 'id' in artist) {
    const res = await payload.find({
      collection: 'products',
      where: { ...relatedBase, artist: { equals: artist.id } },
      limit: 4,
      sort: '-createdAt',
      depth: 1,
      locale: locale as 'en' | 'ar',
    })
    sameArtist = res.docs
  }

  const garmentType =
    product.garmentType && typeof product.garmentType === 'object' && 'name' in product.garmentType
      ? product.garmentType
      : null

  let sameGarment: typeof docs = []
  if (garmentType && 'id' in garmentType) {
    // Exclude the current product and anything already shown in the artist strip
    const excludeIds = [product.id, ...sameArtist.map((p) => p.id)]
    const res = await payload.find({
      collection: 'products',
      where: {
        ...relatedBase,
        garmentType: { equals: garmentType.id },
        id: { not_in: excludeIds },
      },
      limit: 4,
      sort: '-createdAt',
      depth: 1,
      locale: locale as 'en' | 'ar',
    })
    sameGarment = res.docs
  }

  const renderRelatedGrid = (items: typeof docs) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
      {items.map((rel) => {
        const relImages = Array.isArray(rel.images) ? rel.images : []
        const relArtist =
          rel.artist && typeof rel.artist === 'object' && 'name' in rel.artist ? rel.artist : null
        return (
          <ProductCard
            key={rel.id}
            slug={rel.slug}
            title={rel.title}
            price={rel.price}
            imageUrl={relImages[0]?.url ?? undefined}
            imageAlt={resolveAlt(relImages[0]) || undefined}
            artistName={relArtist?.name}
            soldOut={totalStock(rel) === 0}
            currency={currency}
          />
        )
      })}
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd) }}
      />
      {/* Breadcrumb */}
      <nav className="flex gap-2 text-[10px] uppercase tracking-widest text-muted mb-10">
        <Link href="/shop" className="hover:text-foreground transition-colors">{t('shop')}</Link>
        {category && 'name' in category && 'slug' in category && (
          <>
            <span>/</span>
            <Link href={`/shop?category=${category.slug}`} className="hover:text-foreground transition-colors">
              {category.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-foreground">{product.title}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-start">
        {/* Images */}
        <ProductGallery images={galleryImages} />

        {/* Details */}
        <div className="md:sticky md:top-24 space-y-6">
          {artist && 'slug' in artist && (
            <Link
              href={`/artist/${artist.slug}`}
              className="text-[10px] uppercase tracking-[0.3em] text-accent hover:text-accent-hover transition-colors"
            >
              {artist.name}
            </Link>
          )}

          <h1 className="text-3xl font-bold text-foreground leading-tight">{product.title}</h1>

          {product.ratingCount != null && product.ratingCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span className="text-accent" aria-hidden>{'★'.repeat(Math.round(product.ratingAvg || 0))}{'☆'.repeat(5 - Math.round(product.ratingAvg || 0))}</span>
              <span>{t('reviewCount', { count: product.ratingCount })}</span>
            </div>
          )}

          <p className="text-xl text-foreground">
            {formatPrice(product.price)}
            {currency.mode === 'both' && currency.exchangeRate && (
              <span className="block text-sm text-muted mt-0.5">{formatLBP(product.price, currency.exchangeRate)}</span>
            )}
          </p>

          {product.isOneOfAKind && (
            <span className="inline-block text-[10px] uppercase tracking-[0.2em] text-accent border border-accent/40 px-2.5 py-1">
              {t('oneOfAKind')}
            </span>
          )}

          {product.preorderEnabled && (
            <p className="text-xs text-accent uppercase tracking-[0.2em]">
              {product.preorderMessage || t('preorder')}
            </p>
          )}

          {stock > 0 && stock <= 2 && !product.isOneOfAKind && (
            <p className="text-xs text-accent uppercase tracking-[0.2em]">
              {t('onlyLeft', { count: stock })}
            </p>
          )}

          <div className="pt-2">
            {stock === 0 && !product.preorderEnabled ? (
              <div className="space-y-3">
                <AddToCart
                  id={String(product.id)}
                  slug={product.slug}
                  title={product.title}
                  price={product.price}
                  imageUrl={galleryImages[0]?.url}
                  outOfStock
                  sizes={sizes}
                />
                <NotifyMeForm productId={String(product.id)} />
              </div>
            ) : (
              <AddToCart
                id={String(product.id)}
                slug={product.slug}
                title={product.title}
                price={product.price}
                imageUrl={galleryImages[0]?.url}
                outOfStock={false}
                maxQuantity={sizes.length > 0 ? undefined : (product.stockQuantity ?? 1)}
                sizes={sizes}
              />
            )}
            <div className="pt-3">
              <WishlistButton productId={String(product.id)} fetchState />
            </div>
          </div>

          {/* The piece's own story, written per-product in the admin (localized) */}
          {product.description && (
            <div className="pt-4 border-t border-border">
              <RichTextRenderer
                content={product.description as unknown as Parameters<typeof RichTextRenderer>[0]['content']}
              />
            </div>
          )}

          <div className="pt-4 border-t border-border space-y-2 text-xs text-muted">
            {category && 'name' in category && 'slug' in category && (
              <p>
                {t('category')}:{' '}
                <Link
                  href={`/shop?category=${category.slug}`}
                  className="text-foreground hover:text-accent transition-colors"
                >
                  {category.name}
                </Link>
              </p>
            )}
            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {product.tags.map((t: { tag?: string | null }, i: number) => (
                  <span
                    key={i}
                    className="text-[10px] text-muted border border-border px-2 py-0.5 uppercase tracking-wider"
                  >
                    {t.tag}
                  </span>
                ))}
              </div>
            )}
            <p className="pt-2 leading-relaxed text-muted whitespace-pre-line">
              {productBlurb}
            </p>
          </div>

          {/* Flexible specs (ROADMAP Part 6.7) — materials, care, dimensions, etc. */}
          {specs.length > 0 && (
            <div className="pt-4 border-t border-border">
              <dl className="space-y-1.5 text-xs">
                {specs.map((s, i) => (
                  <div key={i} className="flex justify-between gap-4">
                    <dt className="text-muted">{s.label}</dt>
                    <dd className="text-foreground text-end">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Size guide (ROADMAP Part 6.7) — from the product's garment type, when set */}
          {garmentType && 'sizeGuide' in garmentType && garmentType.sizeGuide && (
            <details className="pt-4 border-t border-border text-xs group">
              <summary className="cursor-pointer uppercase tracking-[0.2em] text-muted hover:text-foreground transition-colors">
                {t('sizeGuide')}
              </summary>
              <div className="pt-3">
                <RichTextRenderer
                  content={garmentType.sizeGuide as unknown as Parameters<typeof RichTextRenderer>[0]['content']}
                />
              </div>
            </details>
          )}
        </div>
      </div>

      {/* More from this artist — only ever real same-artist pieces */}
      {sameArtist.length > 0 && artist && 'name' in artist && (
        <section className="mt-24 pt-12 border-t border-border">
          <h2 className="text-xs uppercase tracking-[0.25em] text-muted mb-8">
            {t('moreFrom', { name: artist.name })}
          </h2>
          {renderRelatedGrid(sameArtist)}
        </section>
      )}

      {/* More like this — same garment type, any artist */}
      {sameGarment.length > 0 && (
        <section className={`${sameArtist.length > 0 ? 'mt-16' : 'mt-24'} pt-12 border-t border-border`}>
          <h2 className="text-xs uppercase tracking-[0.25em] text-muted mb-8">
            {t('moreLikeThis')}
          </h2>
          {renderRelatedGrid(sameGarment)}
        </section>
      )}

      {/* Reviews (ROADMAP Part 6.2) */}
      <section className="mt-24 pt-12 border-t border-border max-w-2xl">
        <h2 className="text-xs uppercase tracking-[0.25em] text-muted mb-8">
          {t('reviews')}
        </h2>

        {customer && (
          <div className="mb-10 pb-10 border-b border-border">
            <WriteReviewForm productId={String(product.id)} />
          </div>
        )}

        {reviews.length === 0 ? (
          <p className="text-sm text-muted">{t('noReviews')}</p>
        ) : (
          <div className="space-y-6">
            {reviews.map((r) => (
              <div key={r.id} className="border-b border-border pb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-accent text-sm" aria-hidden>
                    {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                  </span>
                  <span className="text-xs text-foreground">{r.customerName}</span>
                  {r.verifiedPurchase && (
                    <span className="text-[10px] text-muted uppercase tracking-widest">{t('verifiedPurchase')}</span>
                  )}
                </div>
                <p className="text-sm text-muted leading-relaxed">{r.text}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
