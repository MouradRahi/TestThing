import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
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
export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (request.headers.get('sec-fetch-mode') === 'navigate') {
    const pingUrl = new URL('/api/analytics/pageview', request.nextUrl.origin)
    event.waitUntil(fetch(pingUrl, { method: 'POST' }).catch(() => {}))
  }
  return intlMiddleware(request)
}

export const config = {
  // Run on storefront paths only. Exclude the Payload admin (/admin), all API
  // routes (/api), Next internals, and any file with an extension.
  matcher: ['/((?!api|admin|_next|_vercel|.*\\..*).*)'],
}
