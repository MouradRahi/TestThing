// XSS hardening helpers. React/JSX auto-escapes plain `{value}` interpolation
// everywhere in this app — that's the primary defense and covers the vast
// majority of rendered content (names, notes, addresses, reviews, titles).
// These three helpers cover the specific places that step outside that
// protection: raw HTML/CSS injected via `dangerouslySetInnerHTML`, and `href`
// attributes (React never validates a URL's scheme, so a `javascript:` href
// renders — and executes on click — exactly as entered).

/**
 * Safe to embed in a `<script type="application/ld+json">` tag via
 * `dangerouslySetInnerHTML`. `JSON.stringify` alone does not escape `<`, so a
 * value containing the literal string `</script>` breaks out of the tag and
 * turns everything after it into real, parsed HTML. Escaping `<` to its
 * unicode form neutralizes that while staying valid, semantically identical
 * JSON (any JSON/JS parser decodes `<` back to `<`).
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

// Schemes we allow in any staff/admin-entered href field (CTA buttons,
// announcement bar, rich-text links, nav/footer links). Deliberately an
// allowlist, not a blocklist — new dangerous schemes (vbscript:, data:, the
// next one nobody's thought of yet) are rejected by default rather than
// needing to be enumerated.
const SAFE_URL_RE = /^(https?:|mailto:|tel:|\/|#|\?)/i

/**
 * Returns `url` unchanged if it uses an allowed scheme (http(s), mailto,
 * tel) or is a relative/anchor/query path; otherwise returns `fallback`
 * (default `'#'`, a safe no-op) — used anywhere a staff-entered URL renders
 * as a real `href` a customer can click.
 */
export function safeHref(url: string | undefined | null, fallback = '#'): string {
  const trimmed = url?.trim()
  if (!trimmed) return fallback
  return SAFE_URL_RE.test(trimmed) ? trimmed : fallback
}

// Admin-entered "hex color" fields (SiteSettings custom theme colors) get
// interpolated directly into a `<style>` tag's CSS text. A value containing
// `</style>` would close the tag early and turn the remainder of the string
// into real, parsed HTML (including a live `<script>`). Only accept shapes
// that are actually valid CSS color/keyword syntax — 3/4/6/8-digit hex,
// rgb()/rgba()/hsl()/hsla(), a bare CSS keyword (e.g. `transparent`), or a
// `var(--token)` reference. Anything else — including any real style tag by
// definition — is rejected and replaced with the given fallback.
const SAFE_CSS_COLOR_RE = /^(#[0-9a-f]{3,8}|[a-z]+|(rgb|rgba|hsl|hsla)\([\d.,%\s]+\)|var\(--[a-z0-9-]+\))$/i

export function sanitizeCssColor(value: string | undefined | null, fallback: string): string {
  const trimmed = value?.trim()
  if (!trimmed) return fallback
  return SAFE_CSS_COLOR_RE.test(trimmed) ? trimmed : fallback
}
