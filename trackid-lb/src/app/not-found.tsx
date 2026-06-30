// Global fallback for paths that don't resolve into any route group.
// The root layout returns only `children` (no HTML shell), so this page must
// provide its own <html>/<body> to avoid the "Missing <html> and <body>" error.
import Link from 'next/link'
import './(frontend)/globals.css'

export default function GlobalNotFound() {
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
            Error 404
          </p>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: '1rem 0' }}>Page not found</h1>
          <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
            The page you’re looking for doesn’t exist or may have moved.
          </p>
          <Link
            href="/"
            style={{
              textTransform: 'uppercase',
              letterSpacing: '0.25em',
              fontSize: '0.75rem',
              padding: '0.875rem 2.5rem',
              background: 'var(--color-accent, #ededed)',
              color: 'var(--color-on-accent, #0a0a0a)',
              fontWeight: 600,
            }}
          >
            Back to home
          </Link>
        </div>
      </body>
    </html>
  )
}
