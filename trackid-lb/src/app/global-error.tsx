'use client'

// Last-resort error boundary — only fires when the ROOT layout itself throws
// (route-group layouts have their own error.tsx for everything else). The
// root layout returns only `children` (no HTML shell), so this must provide
// its own <html>/<body>, same reasoning as app/not-found.tsx.
import { useEffect } from 'react'
import './[locale]/(frontend)/globals.css'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
    // Dynamic import — see the frontend error.tsx boundary for why.
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error))
    }
  }, [error])

  return (
    <html lang="en">
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '2rem',
            background: 'var(--color-bg, #0a0a0a)',
            color: 'var(--color-foreground, #ededed)',
          }}
        >
          <p style={{ textTransform: 'uppercase', letterSpacing: '0.3em', fontSize: '0.75rem', opacity: 0.6 }}>
            Error
          </p>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: '1rem 0' }}>Something went wrong</h1>
          <p style={{ opacity: 0.7, marginBottom: '2rem' }}>Please refresh the page or try again shortly.</p>
          <a
            href="/"
            style={{
              textTransform: 'uppercase',
              letterSpacing: '0.25em',
              fontSize: '0.75rem',
              padding: '0.875rem 2.5rem',
              background: 'var(--color-accent, #ededed)',
              color: 'var(--color-on-accent, #0a0a0a)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Back to home
          </a>
        </div>
      </body>
    </html>
  )
}
