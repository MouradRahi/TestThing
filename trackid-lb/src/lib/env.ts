/**
 * Server-side environment values that used to carry a `NEXT_PUBLIC_` prefix.
 *
 * Next.js inlines every `process.env.NEXT_PUBLIC_*` reference into the browser
 * bundle, so the prefix made these readable by anyone with devtools. All four
 * are only ever read on the server (Payload config, sitemap/robots, metadata,
 * cron routes, TOTP issuer), so the prefix bought nothing and exposed them for
 * no reason — Vercel's own dashboard flags exactly this.
 *
 * Each value reads the unprefixed name FIRST and falls back to the legacy
 * `NEXT_PUBLIC_` one, so this is safe to deploy before the hosting environment
 * has been updated, and safe to update the hosting environment in either order.
 * Once Production and Preview both carry the new names, the legacy fallbacks
 * below can be deleted.
 *
 * `NEXT_PUBLIC_SENTRY_DSN` deliberately keeps its prefix — it is genuinely read
 * in the browser (error.tsx / global-error.tsx) and a DSN is public by design.
 *
 * Note the references are written as literal `process.env.X` member access
 * rather than dynamic `process.env[name]` lookups: only the literal form is
 * statically replaced by the bundler, so should any of this ever be pulled into
 * a client component the legacy prefixed value still resolves correctly instead
 * of silently becoming `undefined`.
 */

const DEFAULT_SITE_URL = 'http://localhost:3000'
const DEFAULT_STORE_NAME = 'trackID.lb'
const DEFAULT_STORAGE_BUCKET = 'products'

/** Public base URL of this deployment — used for canonicals, sitemap, emails. */
export function getSiteUrl(): string {
  return process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL
}

/** Brand name for surfaces that cannot read SiteSettings (admin chrome, TOTP issuer). */
export function getStoreName(): string {
  return process.env.STORE_NAME || process.env.NEXT_PUBLIC_STORE_NAME || DEFAULT_STORE_NAME
}

/** Supabase project URL, e.g. https://<ref>.supabase.co. Undefined disables public URL rewriting. */
export function getSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
}

/** Supabase Storage bucket holding uploaded media. */
export function getSupabaseStorageBucket(): string {
  return (
    process.env.SUPABASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ||
    DEFAULT_STORAGE_BUCKET
  )
}
