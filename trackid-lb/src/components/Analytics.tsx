'use client'

import { useEffect } from 'react'
import Script from 'next/script'

// Conditionally renders GA4 and/or Meta Pixel — only when the owner has pasted
// an ID in SiteSettings → SEO. No IDs = no third-party scripts shipped.
//
// The gtag/fbq bootstrap logic runs as real, same-origin bundled JS (via
// useEffect) rather than as inline <script> HTML — previously this component
// rendered the standard GA4/Meta snippets as literal template strings via
// next/script's inline-body form, which is exactly the kind of thing a
// Content-Security-Policy's script-src is meant to block (see
// src/lib/csp.ts). Only the actual external library files (gtag.js,
// fbevents.js) are loaded via <Script src=...> — a real network request to
// an allowlisted host, no inline execution involved. This mirrors how
// @vercel/analytics's own script injection already works in this app
// (confirmed by reading its source: it sets `window.va` as compiled code,
// then does `document.createElement('script'); script.src = ...` — never an
// inline script string) — an established, already-proven-safe pattern here,
// not a new one invented for this fix.
type GtagFn = (...args: unknown[]) => void
type FbqFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[]
  loaded: boolean
  version: string
  push: FbqFn
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: GtagFn
    fbq?: FbqFn
    _fbq?: FbqFn
  }
}

export function Analytics({ gaId, pixelId }: { gaId?: string; pixelId?: string }) {
  const ga = gaId?.trim()
  const pixel = pixelId?.trim()

  useEffect(() => {
    if (!ga) return
    window.dataLayer = window.dataLayer || []
    // Standard gtag.js queue shim — calls made before the external gtag.js
    // finishes loading are queued in dataLayer and processed once it's ready.
    window.gtag =
      window.gtag ||
      function gtag(...args: unknown[]) {
        window.dataLayer!.push(args)
      }
    window.gtag('js', new Date())
    window.gtag('config', ga)
  }, [ga])

  useEffect(() => {
    if (!pixel || window.fbq) return
    // Standard Meta Pixel queue shim (same behavior as their own snippet),
    // minus the dynamic <script> injection — that part is handled by the
    // <Script src="...fbevents.js"> below instead.
    const fbq: FbqFn = Object.assign(
      (...args: unknown[]) => {
        if (fbq.callMethod) fbq.callMethod(...args)
        else fbq.queue.push(args)
      },
      { queue: [] as unknown[], loaded: true, version: '2.0' },
    ) as FbqFn
    fbq.push = fbq
    window.fbq = fbq
    window._fbq = window._fbq || fbq
    window.fbq('init', pixel)
    window.fbq('track', 'PageView')
  }, [pixel])

  return (
    <>
      {ga && <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />}
      {pixel && <Script src="https://connect.facebook.net/en_US/fbevents.js" strategy="afterInteractive" />}
      {pixel && (
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            alt=""
            src={`https://www.facebook.com/tr?id=${pixel}&ev=PageView&noscript=1`}
          />
        </noscript>
      )}
    </>
  )
}
