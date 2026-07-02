import { getPayload } from '@/lib/payload'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { AddToCart } from '@/components/product/AddToCart'
import { ProductCard } from '@/components/product/ProductCard'
import { ProductGallery } from '@/components/product/ProductGallery'
import { WishlistButton } from '@/components/account/WishlistButton'
import { getSizes, totalStock } from '@/lib/stock'
import { resolveAlt } from '@/lib/image'
import {
  getSiteSettings,
  resolveStoreName,
  DEFAULT_PRODUCT_BLURB,
  DEFAULT_PRODUCT_META_TAGLINE,
} from '@/lib/site-settings'

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
  const description = `Hand-painted by ${storeName} — ${product.title}. ${metaTagline}`

  return {
    title: product.title,
    description,
    alternates: { canonical: `/product/${product.slug}` },
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

  const [{ docs }, settings] = await Promise.all([
    payload.find({
      collection: 'products',
      where: { slug: { equals: slug }, status: { equals: 'published' } },
      limit: 1,
      depth: 2,
      locale: locale as 'en' | 'ar',
    }),
    getSiteSettings(locale),
  ])

  const product = docs[0]
  if (!product) notFound()

  const t = await getTranslations('product')
  const storeName = resolveStoreName(settings)
  const productBlurb = (settings.productBlurb as string) || DEFAULT_PRODUCT_BLURB

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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: `Hand-painted by ${storeName} — ${product.title}`,
    brand: { '@type': 'Brand', name: storeName },
    image: images.map((img) => img.url).filter(Boolean),
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'USD',
      availability: stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: storeName },
    },
  }

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
            imageUrl={relImages[0]?.url}
            imageAlt={resolveAlt(relImages[0]) || undefined}
            artistName={relArtist?.name}
            soldOut={totalStock(rel) === 0}
          />
        )
      })}
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Breadcrumb */}
      <nav className="flex gap-2 text-[10px] uppercase tracking-widest text-muted mb-10">
        <Link href="/shop" className="hover:text-foreground transition-colors">{t('shop')}</Link>
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

          <p className="text-xl text-foreground">${product.price}</p>

          {product.isOneOfAKind && (
            <span className="inline-block text-[10px] uppercase tracking-[0.2em] text-accent border border-accent/40 px-2.5 py-1">
              {t('oneOfAKind')}
            </span>
          )}

          {stock > 0 && stock <= 2 && !product.isOneOfAKind && (
            <p className="text-xs text-accent uppercase tracking-[0.2em]">
              {t('onlyLeft', { count: stock })}
            </p>
          )}

          <div className="pt-2">
            <AddToCart
              id={String(product.id)}
              slug={product.slug}
              title={product.title}
              price={product.price}
              imageUrl={galleryImages[0]?.url}
              outOfStock={stock === 0}
              maxQuantity={sizes.length > 0 ? undefined : (product.stockQuantity ?? 1)}
              sizes={sizes}
            />
            <div className="pt-3">
              <WishlistButton productId={String(product.id)} fetchState />
            </div>
          </div>

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
                {product.tags.map((t: { tag?: string }, i: number) => (
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
    </div>
  )
}
