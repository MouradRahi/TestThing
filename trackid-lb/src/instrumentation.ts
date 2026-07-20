// Next.js inlines NEXT_PUBLIC_* vars as literals at build time, so this lets
// Terser prove register() is dead code and drop it (and the @sentry/nextjs
// graph it pulls in) entirely when unset.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

export async function register() {
  if (!dsn) return
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
}
