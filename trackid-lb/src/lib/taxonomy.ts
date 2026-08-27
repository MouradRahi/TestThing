/**
 * Admin-definable taxonomies (ROADMAP Part 8.1 — de-verticalization).
 *
 * A brand defines its own groupings as DATA rather than as code: an underwear
 * brand creates a "Manufacturer" taxonomy with terms "Marie France" / "La Senza";
 * a furniture brand creates "Material" with "Oak" / "Walnut". Each taxonomy gets
 * its own URL segment, listing pages, shop filter and product-page display —
 * with no deploy, no migration and no schema change per client.
 *
 * Deliberately parallel to the existing Artists collection, which is left
 * untouched: trackID.lb keeps /artist/ exactly as it is, and a fresh install
 * simply has zero taxonomies defined, so none of this renders at all.
 */

/**
 * URL segments a taxonomy slug may not take.
 *
 * Storefront term pages live at `/<taxonomy>/<term>`, which Next.js resolves
 * only AFTER every literal route segment — so a taxonomy slugged `product` or
 * `shop` would be permanently shadowed by the real route and silently 404 for
 * customers. Reserving them up front turns a mystifying runtime bug into a
 * clear validation error at the moment the admin types the name.
 *
 * Keep in sync with the route folders under `src/app/[locale]/(frontend)/`
 * plus the top-level non-locale routes and the locale codes themselves.
 */
export const RESERVED_TAXONOMY_SLUGS = new Set([
  // storefront route segments
  'account', 'artist', 'blog', 'bundle', 'bundles', 'cart', 'checkout',
  'custom-request', 'order', 'p', 'pay', 'product', 'shop', 'track',
  // framework / infrastructure
  'admin', 'api', 'robots.txt', 'sitemap.xml', '_next', 'favicon.ico',
  // locale prefixes (see src/i18n/routing.ts)
  'en', 'ar',
])

/** True when `slug` collides with a real route and must be rejected. */
export function isReservedTaxonomySlug(slug: unknown): boolean {
  return typeof slug === 'string' && RESERVED_TAXONOMY_SLUGS.has(slug.trim().toLowerCase())
}

/** Field types an admin can choose for a flexible per-term detail field. */
export const TERM_FIELD_TYPES = [
  { label: 'Short text', value: 'text' },
  { label: 'Long text', value: 'textarea' },
  { label: 'Number', value: 'number' },
  { label: 'Link (URL)', value: 'url' },
] as const

export type TermFieldType = (typeof TERM_FIELD_TYPES)[number]['value']

export type TermFieldDef = {
  key: string
  label: string
  fieldType: TermFieldType
}

export type TermDetail = {
  key: string
  value: string
}

/**
 * Pair a taxonomy's declared `termFields` with a term's saved `details`,
 * preserving the admin's field order and dropping values whose field
 * definition has since been deleted. Returns only entries that have a value,
 * so a term that fills in two of five optional fields renders two rows.
 */
export function resolveTermDetails(
  termFields: unknown,
  details: unknown,
): Array<{ key: string; label: string; value: string; fieldType: TermFieldType }> {
  if (!Array.isArray(termFields) || !Array.isArray(details)) return []

  const byKey = new Map<string, string>()
  for (const d of details) {
    const key = (d as TermDetail)?.key
    const value = (d as TermDetail)?.value
    if (typeof key === 'string' && typeof value === 'string' && value.trim()) {
      byKey.set(key.trim(), value.trim())
    }
  }

  const out: Array<{ key: string; label: string; value: string; fieldType: TermFieldType }> = []
  for (const f of termFields) {
    const key = (f as TermFieldDef)?.key
    if (typeof key !== 'string') continue
    const value = byKey.get(key.trim())
    if (!value) continue
    const label = (f as TermFieldDef)?.label
    out.push({
      key: key.trim(),
      label: typeof label === 'string' && label.trim() ? label.trim() : key.trim(),
      value,
      fieldType: ((f as TermFieldDef)?.fieldType ?? 'text') as TermFieldType,
    })
  }
  return out
}
