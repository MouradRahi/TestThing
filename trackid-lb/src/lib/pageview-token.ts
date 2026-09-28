// Shared-secret header proving a /api/analytics/pageview request came from our
// own middleware, not an outside caller. Replaces a per-IP durable rate limit
// that cost a second DB write on every page view — and didn't work anyway,
// since the ping comes from the middleware, so every visitor shared one IP.
//
// Derived (SHA-256) from PAYLOAD_SECRET rather than sending the secret itself,
// so it never travels in a header. Web Crypto only, so the same code runs in
// the Edge middleware and the Node route handler.

export const PAGEVIEW_TOKEN_HEADER = 'x-pageview-token'

let tokenPromise: Promise<string> | null = null

export function getPageviewToken(): Promise<string> {
  if (!tokenPromise) {
    const input = new TextEncoder().encode(`pageview:${process.env.PAYLOAD_SECRET ?? ''}`)
    tokenPromise = crypto.subtle.digest('SHA-256', input).then((buf) =>
      Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join(''),
    )
  }
  return tokenPromise
}
