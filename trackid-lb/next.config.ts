import { withPayload } from '@payloadcms/next/withPayload'
import { withSentryConfig } from '@sentry/nextjs'
import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'
import dns from 'node:dns'

// Windows dev machines intermittently fail to resolve the Supabase pooler
// hostname (getaddrinfo EAI_AGAIN) when IPv6 lookups stall — prefer IPv4.
dns.setDefaultResultOrder('ipv4first')

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        // Demo placeholder imagery used by the seed script (npm run seed)
        protocol: 'https',
        hostname: 'placehold.co',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  // The nonce-based Content-Security-Policy (the strong, per-request part of
  // the XSS defense-in-depth work — see src/lib/csp.ts) is set in
  // middleware.ts, scoped to storefront pages only, since it deliberately
  // doesn't cover /admin (Payload's own panel, unaudited for CSP compat) or
  // /api. These four are static, need no per-request nonce, and are safe to
  // apply everywhere including admin/API responses.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Modern equivalent of frame-ancestors, kept for browsers that
          // don't understand CSP's frame-ancestors directive.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

const baseConfig = withPayload(withNextIntl(nextConfig))

// Sentry is fully optional — the wrap (and its build-time webpack plugin) is
// skipped entirely unless NEXT_PUBLIC_SENTRY_DSN is set, so a fresh clone or a
// deploy without a Sentry project behaves exactly as if this block didn't
// exist. Source-map upload additionally needs SENTRY_AUTH_TOKEN; without it,
// error tracking still works (minified stack traces), just no upload attempt.
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(baseConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
      silent: !process.env.CI,
      widenClientFileUpload: true,
    })
  : baseConfig
