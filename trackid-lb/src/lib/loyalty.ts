import type { Payload } from 'payload'
import { getPool } from './db-pool'

export type LoyaltyConfig = { enabled: boolean; earnRatePerDollar: number; burnPointsPerDollar: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveLoyaltyConfig(settings: Record<string, any>): LoyaltyConfig {
  return {
    enabled: Boolean(settings.loyaltyEnabled),
    earnRatePerDollar: typeof settings.loyaltyEarnRatePerDollar === 'number' ? settings.loyaltyEarnRatePerDollar : 1,
    burnPointsPerDollar: typeof settings.loyaltyBurnPointsPerDollar === 'number' && settings.loyaltyBurnPointsPerDollar > 0 ? settings.loyaltyBurnPointsPerDollar : 100,
  }
}

/** Same atomic conditional-UPDATE shape as store-credit.ts/gift-cards.ts. */
export async function redeemPoints(payload: Payload, customerId: string | number, points: number): Promise<boolean> {
  const pool = getPool(payload)
  if (pool) {
    try {
      const res = await pool.query(
        'UPDATE customers SET loyalty_points = loyalty_points - $1 WHERE id = $2 AND loyalty_points >= $1',
        [points, customerId],
      )
      return (res.rowCount ?? 0) > 0
    } catch (err) {
      console.error('[loyalty] Atomic redemption failed, falling back to read-modify-write:', err)
    }
  }
  const current = await payload.findByID({ collection: 'customers', id: customerId, depth: 0 })
  const balance = Number(current.loyaltyPoints) || 0
  if (balance < points) return false
  await payload.update({ collection: 'customers', id: customerId, data: { loyaltyPoints: balance - points } })
  return true
}

export async function releasePoints(payload: Payload, customerId: string | number, points: number): Promise<void> {
  try {
    const pool = getPool(payload)
    if (pool) {
      await pool.query('UPDATE customers SET loyalty_points = loyalty_points + $1 WHERE id = $2', [points, customerId])
      return
    }
    const current = await payload.findByID({ collection: 'customers', id: customerId, depth: 0 })
    const balance = Number(current.loyaltyPoints) || 0
    await payload.update({ collection: 'customers', id: customerId, data: { loyaltyPoints: balance + points } })
  } catch (err) {
    console.error('[loyalty] Failed to release points redemption:', err)
  }
}

/** Earns points (order delivery, referral reward). Not atomic-guarded (never fails, only ever increments). */
export async function grantPoints(payload: Payload, customerId: string | number, points: number): Promise<void> {
  if (points <= 0) return
  const pool = getPool(payload)
  if (pool) {
    try {
      await pool.query('UPDATE customers SET loyalty_points = loyalty_points + $1 WHERE id = $2', [points, customerId])
      return
    } catch (err) {
      console.error('[loyalty] Atomic grant failed, falling back to read-modify-write:', err)
    }
  }
  const current = await payload.findByID({ collection: 'customers', id: customerId, depth: 0 })
  const balance = Number(current.loyaltyPoints) || 0
  await payload.update({ collection: 'customers', id: customerId, data: { loyaltyPoints: balance + points } })
}
