import type { Payload } from 'payload'

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
