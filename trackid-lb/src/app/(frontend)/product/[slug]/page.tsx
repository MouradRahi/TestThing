import { getPayload } from '@/lib/payload'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { AddToCart } from '@/components/product/AddToCart'

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
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const payload = await getPayload()
  const { docs } = await payload.find({
    collection: 'products',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  })
  const product = docs[0]
  if (!product) return {}
  return {
    title: product.title,
    description: `Hand-painted by trackID.lb — ${product.title}`,
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const payload = await getPayload()

  const { docs } = await payload.find({
    collection: 'products',
    where: { slug: { equals: slug }, status: { equals: 'published' } },
    limit: 1,
    depth: 2,
  })

  const product = docs[0]
  if (!product) notFound()

  const images = Array.isArray(product.images) ? product.images : []
  const primaryImage = images[0]
  const artist =
    product.artist && typeof product.artist === 'object' && 'name' in product.artist
      ? product.artist
      : null
  const category =
    product.category && typeof product.category === 'object' && 'name' in product.category
      ? product.category
      : null

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Breadcrumb */}
      <nav className="flex gap-2 text-[10px] uppercase tracking-widest text-muted mb-10">
        <Link href="/shop" className="hover:text-foreground transition-colors">Shop</Link>
        <span>/</span>
        <span className="text-foreground">{product.title}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-start">
        {/* Images */}
        <div className="space-y-2">
          <div className="aspect-[3/4] bg-surface relative overflow-hidden border border-border">
            {primaryImage?.url ? (
              <Image
                src={primaryImage.url}
                alt={primaryImage.alt || product.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted text-xs uppercase tracking-widest">
                No image
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {images.slice(1, 5).map((img, i) => (
                <div
                  key={i}
                  className="aspect-square bg-surface relative overflow-hidden border border-border"
                >
                  {img.url && (
                    <Image
                      src={img.url}
                      alt={img.alt || product.title}
                      fill
                      className="object-cover"
                      sizes="120px"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="md:sticky md:top-24 space-y-6">
          {artist && 'slug' in artist && (
            <Link
              href={`/shop?artist=${artist.slug}`}
              className="text-[10px] uppercase tracking-[0.3em] text-accent hover:text-accent-hover transition-colors"
            >
              {artist.name}
            </Link>
          )}

          <h1 className="text-3xl font-bold text-foreground leading-tight">{product.title}</h1>

          <p className="text-xl text-foreground">${product.price}</p>

          {product.isOneOfAKind && (
            <span className="inline-block text-[10px] uppercase tracking-[0.2em] text-accent border border-accent/40 px-2.5 py-1">
              One of a kind
            </span>
          )}

          <div className="pt-2">
            <AddToCart
              id={String(product.id)}
              slug={product.slug}
              title={product.title}
              price={product.price}
              imageUrl={primaryImage?.url}
              outOfStock={(product.stockQuantity ?? 1) === 0}
            />
          </div>

          <div className="pt-4 border-t border-border space-y-2 text-xs text-muted">
            {category && 'name' in category && 'slug' in category && (
              <p>
                Category:{' '}
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
                {product.tags.map((t, i) => (
                  <span
                    key={i}
                    className="text-[10px] text-muted border border-border px-2 py-0.5 uppercase tracking-wider"
                  >
                    {t.tag}
                  </span>
                ))}
              </div>
            )}
            <p className="pt-2 leading-relaxed text-muted">
              Hand-painted in Beirut. Each piece is unique — colours and details may vary slightly
              from the photo.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
