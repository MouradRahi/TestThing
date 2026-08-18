// Content-Security-Policy (XSS defense-in-depth) — even if something gets
// past the input-sanitization fixes elsewhere (src/lib/sanitize.ts), a CSP
// blocks the page from being framed by another origin (clickjacking),
// restricts which external hosts scripts/images/connections can come from
// (blocks exfiltration to an attacker-controlled domain, and blocks loading
// a remote attacker-hosted script — a very common real-world XSS payload
// shape), and locks down base-uri/object-src/form-action.
//
// Deliberately static (computed once at module load, not per-request) —
// this app relies heavily on ISR/static rendering for its highest-traffic
// pages (product, artist, bundle, blog, homepage; see CLAUDE.md's "Non-
// Negotiable" performance architecture). A nonce-based CSP needs a fresh
// per-request value, and — confirmed directly in Next.js's own source
// (getScriptNonceFromHeader, read via app-render.js) plus their own docs —
// adopting one forces the *entire app* into dynamic rendering, because
// Next's internal hydration/streaming scripts (`self.__next_f.push(...)`)
// need that same nonce and can't hold a stale one from a cached render.
// That's a real, project-wide performance tradeoff, not a small one — asked
// the user directly rather than deciding unilaterally; the answer was to
// keep ISR and accept the scoped 'unsafe-inline' below instead.
//
// What that means concretely, verified with a real headless-browser CSP
// test (not assumed): a strict nonce-only script-src correctly blocked a
// real inline `<script>`, and correctly did NOT restrict a neighboring
// `<script type="application/ld+json">` at all (browsers never execute
// that MIME type as JS, so CSP doesn't govern it — this app's JSON-LD
// tags, sanitized via jsonLdScript(), need no special CSP allowance
// either way). Separately, the theme CSS variables no longer go through a
// `<style>` element at all — (frontend)/layout.tsx sets them via a
// `style={{...}}` prop on `<html>` instead of `dangerouslySetInnerHTML`,
// which closes that specific CSS-injection vector outright, independent of
// CSP. And GA4/Meta Pixel bootstrapping (Analytics.tsx) no longer renders
// as an inline `<script>` body — it's real same-origin bundled JS now
// (matching how @vercel/analytics's own script injection already worked in
// this app), so the only thing actually requiring 'unsafe-inline' below is
// Next.js's own framework-internal hydration scripts.
const sentryHost = getSentryIngestHost()

const CSP_DIRECTIVES = [
  `default-src 'self'`,
  // 'unsafe-inline' here is scoped to exactly one purpose: letting Next.js's
  // own internal hydration scripts run (see the file header). It does NOT
  // mean an injected inline <script> would be allowed to run undetected —
  // it means this CSP layer doesn't additionally block one, on top of the
  // actual injection points (JSON-LD, theme CSS, hrefs) already being
  // closed elsewhere. What this directive DOES still block: loading a
  // script from any host other than 'self' + the two allowlisted below.
  `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net`,
  // Same reasoning as script-src's 'unsafe-inline', for a different reason:
  // React's `style={{}}` prop compiles to a real `style="..."` HTML
  // attribute, and per the CSP spec there is no way to nonce an *attribute*
  // (only <style> elements/<link> stylesheets can). This app uses that prop
  // pervasively, so blocking it isn't a targeted fix — it would break
  // inline styling everywhere for a residual risk (CSS-only injection can't
  // execute JS) that's real but much lower severity than script injection.
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: https://*.supabase.co https://placehold.co https://www.facebook.com`,
  `font-src 'self' data:`,
  `connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com${sentryHost ? ` https://${sentryHost}` : ''}`,
  `frame-src 'none'`,
  `frame-ancestors 'self'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `upgrade-insecure-requests`,
]

export const CSP_HEADER = CSP_DIRECTIVES.join('; ')

// Sentry's DSN encodes its own ingest host (o<org>.ingest.<region>.sentry.io)
// — derived from the actual configured DSN rather than a guessed wildcard,
// so connect-src stays as tight as possible and needs no manual updates if
// the org/region ever changes. Absent/malformed DSN = Sentry is off anyway
// (matches its own established "fully optional" convention), so nothing extra.
function getSentryIngestHost(): string | null {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return null
  try {
    return new URL(dsn).hostname
  } catch {
    return null
  }
}
