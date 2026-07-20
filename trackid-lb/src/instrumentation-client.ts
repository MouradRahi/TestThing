import type * as SentryTypes from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

// Browser-side error/route-transition tracking. Dynamic import — see
// sentry.server.config.ts for why a static import would defeat the point of
// this being optional (it'd ship the SDK to every visitor regardless of DSN).
if (dsn) {
  import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
    })
  })
}

// Required export name — Next.js calls this on client-side route changes so
// Sentry can attribute errors to the navigation that triggered them. No-op
// (and the SDK is never fetched) without a DSN.
export function onRouterTransitionStart(
  ...args: Parameters<typeof SentryTypes.captureRouterTransitionStart>
) {
  if (!dsn) return
  import('@sentry/nextjs').then((Sentry) => Sentry.captureRouterTransitionStart(...args))
}
