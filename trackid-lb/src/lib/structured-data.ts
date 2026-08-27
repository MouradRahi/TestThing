import { getSiteUrl } from './env'
// Shared JSON-LD builders (ROADMAP Part 7 — structured-data audit / ENHANCEMENTS
// E8). Product schema + per-product AggregateRating already existed
// (product/[slug]/page.tsx); this adds the site-wide Organization/WebSite
// graph and a reusable BreadcrumbList builder for every page that has a
// real navigation trail. Pure functions — no Payload/DB access — callers
// pass already-resolved settings/locale, same convention as notifications.ts.

const siteUrl = getSiteUrl()

function withLocalePrefix(path: string, locale: string, defaultLocale: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return locale === defaultLocale ? `${siteUrl}${p}` : `${siteUrl}/${locale}${p}`
}

/**
 * Organization + WebSite (with a SearchAction so Google can offer a sitelinks
 * search box) as a single @graph — rendered once, site-wide, in the frontend
 * layout. `sameAs` lists social profile URLs from SiteSettings so Google can
 * connect the storefront to its social presence in the Knowledge Graph.
 */
export function buildSiteJsonLd(
  settings: Record<string, unknown>,
  locale: string,
  defaultLocale: string,
): Record<string, unknown> {
  const storeName = (settings.storeName as string) || 'Store'
  const logoUrl = settings.logoUrl as string | undefined
  const socialLinks = Array.isArray(settings.socialLinks) ? settings.socialLinks : []
  const sameAs = socialLinks
    .map((l) => (l && typeof l === 'object' ? (l as { url?: string }).url : undefined))
    .filter((url): url is string => typeof url === 'string' && url.length > 0)
  const homeUrl = withLocalePrefix('/', locale, defaultLocale)
  const shopUrl = withLocalePrefix('/shop', locale, defaultLocale)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}#organization`,
        name: storeName,
        url: siteUrl,
        ...(logoUrl ? { logo: logoUrl } : {}),
        ...(sameAs.length > 0 ? { sameAs } : {}),
        ...(settings.contactEmail ? { email: settings.contactEmail } : {}),
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}#website`,
        name: storeName,
        url: homeUrl,
        publisher: { '@id': `${siteUrl}#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${shopUrl}?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }
}

export type BreadcrumbItem = { name: string; path?: string }

/**
 * `path` is locale-unprefixed (e.g. '/shop') — omit it on the final,
 * current-page item (schema.org allows a breadcrumb's last item to have no
 * `item` URL, since it's the page you're already on).
 */
export function buildBreadcrumbJsonLd(items: BreadcrumbItem[], locale: string, defaultLocale: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      ...(item.path ? { item: withLocalePrefix(item.path, locale, defaultLocale) } : {}),
    })),
  }
}
