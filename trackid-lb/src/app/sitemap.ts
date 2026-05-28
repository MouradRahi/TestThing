import type { MetadataRoute } from 'next'
import { getPayload } from '@/lib/payload'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trackid.lb'
  const payload = await getPayload()

  const [{ docs: products }, { docs: artists }, { docs: pages }] = await Promise.all([
    payload.find({
      collection: 'products',
      where: { status: { equals: 'published' } },
      limit: 500,
      select: { slug: true, updatedAt: true },
    }),
    payload.find({
      collection: 'artists',
      limit: 200,
      select: { slug: true, updatedAt: true },
    }),
    payload.find({
      collection: 'pages',
      limit: 200,
      select: { slug: true, updatedAt: true },
    }),
  ])

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/shop`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/custom-request`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ]

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${siteUrl}/product/${p.slug}`,
    lastModified: new Date(p.updatedAt as string),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const artistRoutes: MetadataRoute.Sitemap = artists.map((a) => ({
    url: `${siteUrl}/artist/${a.slug}`,
    lastModified: new Date(a.updatedAt as string),
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  const pageRoutes: MetadataRoute.Sitemap = pages.map((p) => ({
    url: `${siteUrl}/p/${p.slug}`,
    lastModified: new Date(p.updatedAt as string),
    changeFrequency: 'monthly',
    priority: 0.5,
  }))

  return [...staticRoutes, ...productRoutes, ...artistRoutes, ...pageRoutes]
}
