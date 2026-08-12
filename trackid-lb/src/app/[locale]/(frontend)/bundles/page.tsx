import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { getPayload } from '@/lib/payload'
import { formatPrice } from '@/lib/format'
import { localizedAlternates } from '@/lib/seo'

// The storefront-discovery gap this closes: Bundles (ROADMAP Part 6.7) had
// an admin collection + individual /bundle/[slug] pages, but nothing ever
// listed them — a customer could only reach one via a direct link nobody
// had anywhere to put. This is that missing index. ISR like the homepage
// (bundles change rarely) — revalidated via Bundles.ts's existing afterChange
// hook pattern would need a matching safeRevalidatePath('/bundles') there;
// added below alongside the individual-bundle revalidation it already does.
export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return { alternates: localizedAlternates('/bundles', locale) }
}

export default async function BundlesPage() {
  const payload = await getPayload()
  const locale = (await getLocale()) as 'en' | 'ar'
  const t = await getTranslations('bundles')
  const tProduct = await getTranslations('product')

  const { docs } = await payload.find({
    collection: 'bundles',
    where: { status: { equals: 'published' } },
    sort: '-createdAt',
    limit: 100,
    depth: 2,
    locale,
  })

  type ResolvedBundle = {
    slug: string
    title: string
    bundlePrice: number
    sumOfParts: number
    imageUrl?: string
    imageAlt?: string
  }

  const bundles: ResolvedBundle[] = docs.map((bundle) => {
    const rows: Array<{ product: unknown; quantity: number }> = Array.isArray(bundle.products) ? bundle.products : []
    let sumOfParts = 0
    let imageUrl: string | undefined
    let imageAlt: string | undefined
    for (const row of rows) {
      const p = row.product
      if (!p || typeof p !== 'object' || !('id' in p)) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const product = p as any
      sumOfParts += (Number(product.price) || 0) * (row.quantity || 1)
      if (!imageUrl) {
        const images = Array.isArray(product.images) ? product.images : []
        imageUrl = images[0]?.url as string | undefined
        imageAlt = (images[0]?.alt as string | undefined) || (product.title as string | undefined)
      }
    }
    return {
      slug: bundle.slug,
      title: bundle.title,
      bundlePrice: bundle.bundlePrice,
      sumOfParts,
      imageUrl,
      imageAlt,
    }
  })

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-baseline justify-between mb-10">
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <span className="text-xs text-muted uppercase tracking-widest">
          {bundles.length === 0 ? t('noBundles') : t('bundleCount', { count: bundles.length })}
        </span>
      </div>

      {bundles.length === 0 ? (
        <p className="text-sm text-muted">{t('noBundles')}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {bundles.map((bundle) => (
            <Link key={bundle.slug} href={`/bundle/${bundle.slug}`} className="group block">
              <div className="aspect-[3/4] bg-surface overflow-hidden relative border border-border group-hover:border-accent/30 transition-colors duration-300">
                {bundle.imageUrl ? (
                  <Image
                    src={bundle.imageUrl}
                    alt={bundle.imageAlt || bundle.title}
                    fill
                    className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted text-xs uppercase tracking-widest">
                    {tProduct('noImage')}
                  </div>
                )}
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-sm text-foreground leading-snug">{bundle.title}</p>
                <p className="text-sm text-muted">
                  {formatPrice(bundle.bundlePrice)}
                  {bundle.sumOfParts > bundle.bundlePrice && (
                    <span className="ms-2 text-muted/60 line-through">{formatPrice(bundle.sumOfParts)}</span>
                  )}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
