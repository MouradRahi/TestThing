// Only ever imported by instrumentation.ts's register() for the edge runtime
// (middleware) — see sentry.server.config.ts for why this can be a plain
// static import despite the "keep it optional" goal.
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
})
