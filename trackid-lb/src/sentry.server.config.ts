// Only ever imported by instrumentation.ts's register(), which already
// guards on NEXT_PUBLIC_SENTRY_DSN being set at build time — when it's not,
// this whole module (including the @sentry/nextjs import below) is dead code
// that Terser removes, not just an unreached-but-still-bundled branch.
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Full traces in dev, a light sample in prod — traces are for performance
  // visibility, not correctness, so this app doesn't need much of it.
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
})
