import type { Payload } from 'payload'

// Shared accessor for Payload's underlying pg Pool — used wherever an atomic
// single-round-trip SQL statement is needed (conditional stock decrement,
// discount redemption, rate-limit counters) that Payload's own ORM/Local API
// can't express. Previously duplicated per-file; centralized here.
export type PgPool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number | null; rows: unknown[] }>
}

export function getPool(payload: Payload): PgPool | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = (payload.db as any).pool
  return pool && typeof pool.query === 'function' ? (pool as PgPool) : null
}
