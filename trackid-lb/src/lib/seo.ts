import { routing } from '@/i18n/routing'

export function withLocalePrefix(path: string, locale: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return locale === routing.defaultLocale ? p : `/${locale}${p}`
}

/**
 * Locale-aware canonical + hreflang for a given unprefixed path (e.g.
 * '/product/foo'). Every `generateMetadata` that sets a canonical was
 * hardcoding the unprefixed (English) URL even on /ar pages — search engines
 * were told the Arabic site is a duplicate of the English one, and with no
 * hreflang at all, Arabic content had no way to rank (BUGS.md B9). Canonical
 * now points at the *current* locale's own URL; `languages` lists every
 * locale's URL plus an `x-default` fallback to the default locale.
 *
 * Paths are relative — resolved against the layout's `metadataBase`, same as
 * the canonicals this replaces.
 */
export function localizedAlternates(path: string, locale: string) {
  const languages: Record<string, string> = {}
  for (const l of routing.locales) {
    languages[l] = withLocalePrefix(path, l)
  }
  languages['x-default'] = withLocalePrefix(path, routing.defaultLocale)
  return {
    canonical: withLocalePrefix(path, locale),
    languages,
  }
}
