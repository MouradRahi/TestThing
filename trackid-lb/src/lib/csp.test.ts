import { afterEach, describe, expect, it, vi } from 'vitest'

// CSP_HEADER is computed once at module load (it's static — see csp.ts for
// why), so exercising different NEXT_PUBLIC_SENTRY_DSN values means
// resetting the module registry and re-importing fresh each time.
async function loadCspWith(dsn: string | undefined) {
  vi.resetModules()
  if (dsn === undefined) vi.unstubAllEnvs()
  else vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', dsn)
  const { CSP_HEADER } = await import('./csp')
  return CSP_HEADER
}

describe('CSP_HEADER', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('locks down the fundamentals', async () => {
    const csp = await loadCspWith(undefined)
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'self'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("default-src 'self'")
  })

  it('restricts script-src to self, unsafe-inline (required by Next.js\'s own hydration scripts — see file comment), and the two known analytics hosts', async () => {
    const csp = await loadCspWith(undefined)
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'))
    expect(scriptSrc).toBeDefined()
    expect(scriptSrc).toContain("'self'")
    expect(scriptSrc).toContain('unsafe-inline')
    expect(scriptSrc).not.toContain('nonce-')
    // still blocks an arbitrary, unlisted external host
    expect(scriptSrc).not.toContain('evil.com')
  })

  it('allows the known GA4/Meta Pixel external script hosts', async () => {
    const csp = await loadCspWith(undefined)
    expect(csp).toContain('https://www.googletagmanager.com')
    expect(csp).toContain('https://connect.facebook.net')
  })

  it('keeps style-src unsafe-inline (React style props cannot carry a nonce)', async () => {
    const csp = await loadCspWith(undefined)
    expect(csp).toContain("style-src 'self' 'unsafe-inline'")
  })

  it('omits a Sentry connect-src host when no DSN is configured', async () => {
    const csp = await loadCspWith('')
    expect(csp).not.toContain('ingest')
  })

  it('adds the exact ingest host derived from a configured DSN', async () => {
    const csp = await loadCspWith('https://abc@o123.ingest.de.sentry.io/456')
    expect(csp).toContain('https://o123.ingest.de.sentry.io')
  })

  it('ignores a malformed DSN rather than throwing', async () => {
    await expect(loadCspWith('not-a-url')).resolves.toBeDefined()
  })
})
