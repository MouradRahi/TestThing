import type { Payload } from 'payload'
import { getPool } from './db-pool'
import { rateLimit as inMemoryRateLimit } from './api-guards'

/**
 * Durable, fixed-window rate limit backed by Postgres (ROADMAP F0 §1.3) —
 * replaces the in-memory sliding-window map in api-guards.ts, which resets
 * per serverless instance and does nothing once traffic spreads across more
 * than one (the exact scenario a real attack, or just Vercel scaling out,
 * produces). Same call shape as the old `rateLimit()`, now async.
 *
 * A single UPSERT does the whole "read window, decide reset-or-increment,
 * write" cycle atomically — two concurrent requests for the same key can't
 * both read a stale count and both slip through (the same class of race
 * fixed for stock/discounts elsewhere in this codebase).
 *
 * Falls back to the in-memory limiter only if the pool isn't reachable
 * (mirrors the stock-decrement/discount-redemption fallback pattern) — rare,
 * and only means a brief loss of cross-instance durability, not an outage.
 */
export async function durableRateLimit(
  payload: Payload,
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const pool = getPool(payload)
  if (!pool) return inMemoryRateLimit(key, limit, windowMs)

  try {
    const res = await pool.query(
      `INSERT INTO rate_limit_counters (key, count, window_start)
       VALUES ($1, 1, now())
       ON CONFLICT (key) DO UPDATE SET
         count = CASE
           WHEN rate_limit_counters.window_start < now() - ($2 || ' milliseconds')::interval
           THEN 1
           ELSE rate_limit_counters.count + 1
         END,
         window_start = CASE
           WHEN rate_limit_counters.window_start < now() - ($2 || ' milliseconds')::interval
           THEN now()
           ELSE rate_limit_counters.window_start
         END
       RETURNING count`,
      [key, windowMs],
    )
    const count = Number((res.rows[0] as { count: number } | undefined)?.count ?? 1)
    return count <= limit
  } catch (err) {
    console.error('[durable-rate-limit] Query failed, falling back to in-memory:', err)
    return inMemoryRateLimit(key, limit, windowMs)
  }
}
