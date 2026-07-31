import type { Payload } from 'payload'
import { getPool } from './db-pool'

// Single atomic UPSERT per page view — same pattern as durable-rate-limit.ts
// and the stock/discount atomic decrements elsewhere in this codebase.
// Silently no-ops if the pool isn't reachable: a missed page view is not
// worth failing (or even slowing down) the request over.
export async function recordPageView(payload: Payload): Promise<void> {
  const pool = getPool(payload)
  if (!pool) return
  const date = new Date().toISOString().slice(0, 10)
  try {
    await pool.query(
      `INSERT INTO analytics_counters (date, page_views)
       VALUES ($1, 1)
       ON CONFLICT (date) DO UPDATE SET page_views = analytics_counters.page_views + 1`,
      [date],
    )
  } catch (err) {
    console.error('[analytics] Failed to record page view:', err)
  }
}
