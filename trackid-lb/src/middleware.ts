import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { CSP_HEADER } from './lib/csp'
import type { NextFetchEvent, NextRequest } from 'next/server'

const intlMiddleware = createMiddleware(routing)

// Lightweight, cookie-free page-view counter (ROADMAP Part 4 §4.3's funnel
// "sessions" stage) — a fire-and-forget ping to /api/analytics/pageview via
// event.waitUntil(), so it never adds latency to the actual response. Only
// real navigations are counted (`sec-fetch-mode: navigate`, set by the
// browser on top-level document loads) — this excludes Next.js's own
// prefetch requests and client-side RSC segment fetches, which don't carry
// that header, so hovering a link or client navigation doesn't inflate the
// count the way every request would.
const UTM_COOKIE = 'utm_data'
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign'] as const

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (request.headers.get('sec-fetch-mode') === 'navigate') {
    const pingUrl = new URL('/api/analytics/pageview', request.nextUrl.origin)
    event.waitUntil(fetch(pingUrl, { method: 'POST' }).catch(() => {}))
  }

  const response = intlMiddleware(request)

  // Content-Security-Policy (XSS defense-in-depth) — static, no per-request
  // nonce. Nothing this app renders needs one: verified with a real browser
  // (Playwright) that CSP's script-src doesn't even govern
  // `<script type="application/ld+json">` tags (browsers never execute them
  // as JS), and the only two genuinely-inline *executable* scripts
  // (GA4/Meta Pixel bootstrapping, Analytics.tsx) were rewritten to run as
  // real same-origin bundled JS instead of inline HTML — so there's nothing
  // left that would require sacrificing ISR/static rendering (product,
  // artist, bundle, blog, homepage) to thread a per-request value through
  // `headers()`. See src/lib/csp.ts for the full policy + reasoning.
  if (response) response.headers.set('Content-Security-Policy', CSP_HEADER)

  // Campaign attribution (ROADMAP Part 7) — first-touch: only set once per
  // visitor, so a later direct/organic visit before checkout never overwrites
  // the campaign that actually brought them. Read back at order creation
  // (POST /api/orders) and snapshotted onto the order. Plain (non-httpOnly)
  // isn't needed — nothing client-side ever reads this — so it's httpOnly
  // like the cart-session cookie.
  if (response && !request.cookies.get(UTM_COOKIE)) {
    const params = request.nextUrl.searchParams
    const utm: Record<string, string> = {}
    for (const key of UTM_PARAMS) {
      const value = params.get(key)
      if (value) utm[key] = value.slice(0, 100)
    }
    if (Object.keys(utm).length > 0) {
      response.cookies.set(UTM_COOKIE, JSON.stringify(utm), {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      })
    }
  }

  return response
}

export const config = {
  // Run on storefront paths only. Exclude the Payload admin (/admin), all API
  // routes (/api), Next internals, and any file with an extension.
  matcher: ['/((?!api|admin|_next|_vercel|.*\\..*).*)'],
}
