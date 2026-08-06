import type { Payload } from 'payload'
import { getPool } from './db-pool'

export type GiftCardResult =
  | { ok: true; id: string | number; remainingBalance: number }
  | { ok: false; error: string }

/** Validate a gift card code against the DB. Redemption itself is atomic — see redeemGiftCardAmount. */
export async function resolveGiftCard(payload: Payload, rawCode: unknown): Promise<GiftCardResult> {
  const code = String(rawCode ?? '').trim().toUpperCase().replace(/\s+/g, '')
  if (!code) return { ok: false, error: 'Enter a gift card code.' }

  const { docs } = await payload.find({
    collection: 'gift-cards',
    where: { code: { equals: code } },
    limit: 1,
    depth: 0,
  })
  const gc = docs[0] as
    | { id: string | number; enabled?: boolean; remainingBalance?: number; expiresAt?: string | null }
    | undefined

  if (!gc || gc.enabled === false) return { ok: false, error: 'This gift card code isn’t valid.' }
  if (gc.expiresAt && new Date(gc.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: 'This gift card has expired.' }
  }
  const remainingBalance = typeof gc.remainingBalance === 'number' ? gc.remainingBalance : 0
  if (remainingBalance <= 0) return { ok: false, error: 'This gift card has no remaining balance.' }

  return { ok: true, id: gc.id, remainingBalance }
}

/**
 * Atomically deducts `amount` from a gift card's remaining balance — same
 * conditional-UPDATE shape as the stock decrement and discount redemption
 * (re-checks the balance at the DB level so two concurrent checkouts against
 * the same card's last few dollars can't both succeed). Call once per order,
 * before stock is touched, and roll back with releaseGiftCardAmount() if a
 * later step fails.
 */
export async function redeemGiftCardAmount(payload: Payload, giftCardId: string | number, amount: number): Promise<boolean> {
  const pool = getPool(payload)
  if (pool) {
    try {
      const res = await pool.query(
        'UPDATE gift_cards SET remaining_balance = remaining_balance - $1 WHERE id = $2 AND remaining_balance >= $1',
        [amount, giftCardId],
      )
      return (res.rowCount ?? 0) > 0
    } catch (err) {
      console.error('[gift-cards] Atomic redemption failed, falling back to read-modify-write:', err)
    }
  }
  const current = await payload.findByID({ collection: 'gift-cards', id: giftCardId, depth: 0 })
  const remaining = Number(current.remainingBalance) || 0
  if (remaining < amount) return false
  await payload.update({ collection: 'gift-cards', id: giftCardId, data: { remainingBalance: remaining - amount } })
  return true
}

/** Reverses a redemption when a later checkout step fails (stock/order creation). */
export async function releaseGiftCardAmount(payload: Payload, giftCardId: string | number, amount: number): Promise<void> {
  try {
    const pool = getPool(payload)
    if (pool) {
      await pool.query('UPDATE gift_cards SET remaining_balance = remaining_balance + $1 WHERE id = $2', [amount, giftCardId])
      return
    }
    const current = await payload.findByID({ collection: 'gift-cards', id: giftCardId, depth: 0 })
    const remaining = Number(current.remainingBalance) || 0
    await payload.update({ collection: 'gift-cards', id: giftCardId, data: { remainingBalance: remaining + amount } })
  } catch (err) {
    console.error('[gift-cards] Failed to release gift card redemption:', err)
  }
}
