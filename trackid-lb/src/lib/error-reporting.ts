/**
 * Server-side error reporting for route handlers. NOT used from
 * instrumentation.ts's onRequestError hook — that export, even behind a
 * runtime guard, forces Next.js to inline the full @sentry/nextjs SDK into
 * the edge/middleware bundle (~80KB, unconditionally, verified while wiring
 * this up). Calling this explicitly from a route's own catch block instead
 * keeps Sentry entirely out of the edge bundle — this file is only ever
 * reachable from Node.js API routes, never from middleware.
 *
 * Always console.error too — this never replaces that, only adds to it.
 */
export function reportServerError(err: unknown, context?: Record<string, unknown>): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return
  import('@sentry/nextjs').then((Sentry) => {
    Sentry.captureException(err, context ? { extra: context } : undefined)
  })
}
