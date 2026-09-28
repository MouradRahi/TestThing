import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/env'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // /shop is rendered per request, and its filter/sort/pagination query
      // strings multiply into an effectively unbounded URL space — every one a
      // full server render. Crawlers index the bare /shop (canonicals already
      // point there) and reach products through the sitemap instead.
      disallow: ['/admin/', '/api/', '/shop?', '/ar/shop?'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
