import type { Payload } from 'payload'
import { getPool } from './db-pool'

export type DiscountType = 'percentage' | 'fixed'

export type DiscountResult =
  | { ok: true; id: string | number; code: string; type: DiscountType; value: number; amount: number }
  | { ok: false; error: string }

// Round to cents, never negative, never more than the subtotal.
export function computeDiscountAmount(type: DiscountType, value: number, subtotal: number): number {
  const raw = type === 'percentage' ? (subtotal * value) / 100 : value
  const clamped = Math.max(0, Math.min(raw, subtotal))
  return Math.round(clamped * 100) / 100
}

/**
 * Validate a discount code against the DB and compute the amount off the given
 * subtotal. Used both by the live checkout validate endpoint and by the orders
 * API at submit time — the orders API result is the authoritative one.
 */
export async function resolveDiscount(
  payload: Payload,
  rawCode: unknown,
  subtotal: number,
): Promise<DiscountResult> {
  const code = String(rawCode ?? '').trim().toUpperCase().replace(/\s+/g, '')
  if (!code) return { ok: false, error: 'Enter a code.' }

  const { docs } = await payload.find({
    collection: 'discounts',
    where: { code: { equals: code } },
    limit: 1,
    depth: 0,
  })
  const d = docs[0] as
    | {
        id: string | number
        type?: DiscountType
        value?: number
        enabled?: boolean
        minSubtotal?: number | null
        expiresAt?: string | null
        usageLimit?: number | null
        usageCount?: number | null
      }
    | undefined

  if (!d || d.enabled === false) return { ok: false, error: 'This code isn’t valid.' }
  if (d.expiresAt && new Date(d.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: 'This code has expired.' }
  }
  if (d.usageLimit && (d.usageCount ?? 0) >= d.usageLimit) {
    return { ok: false, error: 'This code has reached its usage limit.' }
  }
  if (d.minSubtotal && subtotal < d.minSubtotal) {
    return { ok: false, error: `Spend at least $${d.minSubtotal.toFixed(2)} to use this code.` }
  }

  const type: DiscountType = d.type === 'fixed' ? 'fixed' : 'percentage'
  const value = typeof d.value === 'number' ? d.value : 0
  const amount = computeDiscountAmount(type, value, subtotal)
  if (amount <= 0) return { ok: false, error: 'This code isn’t valid for your cart.' }

  return { ok: true, id: d.id, code, type, value, amount }
}

// ── Redemption ───────────────────────────────────────────────────────────────
// resolveDiscount's usageLimit check above is a read, not a guarantee: two
// concurrent checkouts for a code's last remaining use could both pass it and
// both place an order. Claiming the redemption atomically (mirrors the stock
// conditional-decrement pattern in the orders route) closes that race.

/**
 * Atomically claims one use of a discount code — re-checks usageLimit at the
 * DB level so the check and the increment can't be split by a race. Codes
 * with no usageLimit always succeed. Call once per order, before any stock is
 * touched, and roll back with releaseDiscount() if a later step fails.
 */
export async function redeemDiscount(payload: Payload, discountId: string | number): Promise<boolean> {
  const pool = getPool(payload)
  if (pool) {
    try {
      const res = await pool.query(
        'UPDATE discounts SET usage_count = usage_count + 1 WHERE id = $1 AND (usage_limit IS NULL OR usage_count < usage_limit)',
        [discountId],
      )
      return (res.rowCount ?? 0) > 0
    } catch (err) {
      console.error('[discounts] Atomic redemption failed, falling back to read-modify-write:', err)
    }
  }
  // Fallback without direct pool access — not atomic (same caveat as the
  // orders route's stock-decrement fallback), but correct for the common
  // single-instance case.
  const current = await payload.findByID({ collection: 'discounts', id: discountId, depth: 0 })
  const usageLimit = current.usageLimit as number | null | undefined
  const usageCount = Number(current.usageCount) || 0
  if (usageLimit != null && usageCount >= usageLimit) return false
  await payload.update({ collection: 'discounts', id: discountId, data: { usageCount: usageCount + 1 } })
  return true
}

/** Reverses a redemption when a later checkout step fails (stock/order creation). */
export async function releaseDiscount(payload: Payload, discountId: string | number): Promise<void> {
  try {
    const pool = getPool(payload)
    if (pool) {
      await pool.query('UPDATE discounts SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = $1', [discountId])
      return
    }
    const current = await payload.findByID({ collection: 'discounts', id: discountId, depth: 0 })
    const usageCount = Number(current.usageCount) || 0
    await payload.update({
      collection: 'discounts',
      id: discountId,
      data: { usageCount: Math.max(0, usageCount - 1) },
    })
  } catch (err) {
    console.error('[discounts] Failed to release discount redemption:', err)
  }
}
