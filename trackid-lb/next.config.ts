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
