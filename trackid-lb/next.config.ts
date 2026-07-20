import { withPayload } from '@payloadcms/next/withPayload'
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

export default withPayload(withNextIntl(nextConfig))
