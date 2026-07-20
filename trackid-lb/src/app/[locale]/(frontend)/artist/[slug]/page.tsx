import { getPayload } from '@/lib/payload'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { ProductCard } from '@/components/product/ProductCard'
import { Button } from '@/components/ui/Button'
import { resolveAlt } from '@/lib/image'
import { getSiteSettings, resolveStoreName } from '@/lib/site-settings'

export const revalidate = 3600

export async function generateStaticParams() {
  const payload = await getPayload()
  const { docs } = await payload.find({
    collection: 'artists',
    limit: 200,
    select: { slug: true },
  })
  return docs.map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const payload = await getPayload()
  const { docs } = await payload.find({
    collection: 'artists',
    where: { slug: { equals: slug } },
    limit: 1,
    locale: locale as 'en' | 'ar',
  })
  const artist = docs[0]
  if (!artist) return {}

  const storeName = resolveStoreName(await getSiteSettings(locale))
  const description = artist.bio
    ? `${artist.bio.slice(0, 140)}...`
    : `Hand-painted pieces inspired by ${artist.name} — ${storeName}`

  return {
    title: artist.name,
    description,
    alternates: { canonical: `/artist/${artist.slug}` },
    openGraph: {
      title: artist.name,
      description,
      type: 'website',
      ...(artist.photo && { images: [{ url: artist.photo, alt: artist.name }] }),
    },
    twitter: {
      card: 'summary_large_image',
      title: artist.name,
      description,
      ...(artist.photo && { images: [artist.photo] }),
    },
  }
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const payload = await getPayload()

  const [{ docs: artistDocs }, ] = await Promise.all([
    payload.find({
      collection: 'artists',
      where: { slug: { equals: slug } },
      limit: 1,
      locale: locale as 'en' | 'ar',
    }),
  ])

  const artist = artistDocs[0]
  if (!artist) notFound()

  const { docs: products } = await payload.find({
    collection: 'products',
    where: {
      artist: { equals: artist.id },
      status: { equals: 'published' },
    },
    limit: 48,
    sort: '-createdAt',
    depth: 1,
    locale: locale as 'en' | 'ar',
  })

  return (
    <div>
      {/* Artist hero */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <nav className="flex gap-2 text-[10px] uppercase tracking-widest text-muted mb-10">
          <Link href="/shop" className="hover:text-foreground transition-colors">Shop</Link>
          <span>/</span>
          <span className="text-foreground">{artist.name}</span>
        </nav>

        <div className="grid md:grid-cols-[1fr_2fr] gap-10 lg:gap-20 items-start mb-20">
          {/* Photo */}
          {artist.photo ? (
            <div className="aspect-[3/4] bg-surface border border-border relative overflow-hidden">
              <Image
                src={artist.photo}
                alt={artist.name}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            </div>
          ) : (
            <div className="aspect-[3/4] bg-surface border border-border flex items-center justify-center">
              <span className="text-muted text-xs uppercase tracking-widest">No photo</span>
            </div>
          )}

          {/* Info */}
          <div className="md:pt-6">
            {artist.genre && (
              <p className="text-accent text-[10px] uppercase tracking-[0.4em] mb-4">
                {artist.genre}
              </p>
            )}
            <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight mb-8">
              {artist.name}
            </h1>
            {artist.bio && (
              <p className="text-muted text-sm leading-relaxed max-w-prose">
                {artist.bio}
              </p>
            )}
            <div className="mt-10">
              <Button href={`/shop?artist=${artist.slug}`} variant="secondary" size="md">
                Browse all {artist.name} pieces
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Products */}
      {products.length > 0 && (
        <div className="border-t border-border">
          <div className="max-w-7xl mx-auto px-6 py-16">
            <h2 className="text-xs uppercase tracking-[0.25em] text-muted mb-10">
              Pieces — {artist.name}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {products.map((product) => {
                const images = Array.isArray(product.images) ? product.images : []
                return (
                  <ProductCard
                    key={product.id}
                    slug={product.slug}
                    title={product.title}
                    price={product.price}
                    imageUrl={images[0]?.url ?? undefined}
                    imageAlt={resolveAlt(images[0]) || undefined}
                    artistName={artist.name}
                  />
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
