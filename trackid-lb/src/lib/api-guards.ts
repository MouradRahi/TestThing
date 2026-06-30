// Abuse guards for the public POST routes (orders, custom requests).
// Rate limiting is in-memory per serverless instance — at this store's scale
// that is enough to blunt bot spam without external infrastructure.

const buckets = new Map<string, number[]>()
const MAX_BUCKETS = 5000

/** Sliding-window rate limit. Returns false when the caller should be rejected. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, hits] of buckets) {
      if (hits.every((t) => now - t >= windowMs)) buckets.delete(k)
    }
  }

  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)
  return true
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

/** Returns the trimmed value if it is a non-empty string within maxLen, otherwise null. */
export function cleanString(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLen) return null
  return trimmed
}

/** Optional field variant — absent/empty is fine (undefined), oversized or non-string is invalid (null). */
export function cleanOptional(value: unknown, maxLen: number): string | undefined | null {
  if (value === undefined || value === null || value === '') return undefined
  return cleanString(value, maxLen)
}
