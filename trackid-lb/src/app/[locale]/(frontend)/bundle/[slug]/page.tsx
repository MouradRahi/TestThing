import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getPayload } from '@/lib/payload'
import { ProductCard } from '@/components/product/ProductCard'
import { AddBundleToCart } from '@/components/product/AddBundleToCart'
import { formatPrice } from '@/lib/format'

export const revalidate = 3600

type Props = { params: Promise<{ locale: string; slug: string }> }

export default async function BundlePage({ params }: Props) {
  const { locale, slug } = await params
  const payload = await getPayload()
  const t = await getTranslations('product')

  const { docs } = await payload.find({
    collection: 'bundles',
    where: { slug: { equals: slug }, status: { equals: 'published' } },
    limit: 1,
    depth: 2,
    locale: locale as 'en' | 'ar',
  })
  const bundle = docs[0]
  if (!bundle) notFound()

  const rows: Array<{ product: unknown; quantity: number }> = Array.isArray(bundle.products) ? bundle.products : []
  const resolved = rows
    .map((r) => {
      const p = r.product
      if (!p || typeof p !== 'object' || !('id' in p)) return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const product = p as any
      const images = Array.isArray(product.images) ? product.images : []
      return {
        id: String(product.id),
        slug: product.slug as string,
        title: product.title as string,
        price: product.price as number,
        imageUrl: images[0]?.url as string | undefined,
        quantity: r.quantity || 1,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const sumOfParts = resolved.reduce((sum, p) => sum + p.price * p.quantity, 0)

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-foreground mb-3">{bundle.title}</h1>
      {bundle.description && <p className="text-sm text-muted mb-8 max-w-xl">{bundle.description}</p>}

      <div className="flex items-baseline gap-3 mb-10">
        <span className="text-2xl text-foreground">{formatPrice(bundle.bundlePrice)}</span>
        {sumOfParts > bundle.bundlePrice && (
          <span className="text-sm text-muted line-through">{formatPrice(sumOfParts)}</span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        {resolved.map((p, i) => (
          <ProductCard key={i} slug={p.slug} title={p.title} price={p.price} imageUrl={p.imageUrl} />
        ))}
      </div>

      <div className="max-w-xs">
        <AddBundleToCart items={resolved} />
      </div>
    </div>
  )
}
