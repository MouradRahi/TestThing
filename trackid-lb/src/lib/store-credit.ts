import type { Payload } from 'payload'
import { getPool } from './db-pool'

/** Same atomic conditional-UPDATE shape as gift-cards.ts/discounts.ts — re-checks the balance at the DB level. */
export async function redeemStoreCredit(payload: Payload, customerId: string | number, amount: number): Promise<boolean> {
  const pool = getPool(payload)
  if (pool) {
    try {
      const res = await pool.query(
        'UPDATE customers SET store_credit = store_credit - $1 WHERE id = $2 AND store_credit >= $1',
        [amount, customerId],
      )
      return (res.rowCount ?? 0) > 0
    } catch (err) {
      console.error('[store-credit] Atomic redemption failed, falling back to read-modify-write:', err)
    }
  }
  const current = await payload.findByID({ collection: 'customers', id: customerId, depth: 0 })
  const balance = Number(current.storeCredit) || 0
  if (balance < amount) return false
  await payload.update({ collection: 'customers', id: customerId, data: { storeCredit: balance - amount } })
  return true
}

export async function releaseStoreCredit(payload: Payload, customerId: string | number, amount: number): Promise<void> {
  try {
    const pool = getPool(payload)
    if (pool) {
      await pool.query('UPDATE customers SET store_credit = store_credit + $1 WHERE id = $2', [amount, customerId])
      return
    }
    const current = await payload.findByID({ collection: 'customers', id: customerId, depth: 0 })
    const balance = Number(current.storeCredit) || 0
    await payload.update({ collection: 'customers', id: customerId, data: { storeCredit: balance + amount } })
  } catch (err) {
    console.error('[store-credit] Failed to release store credit redemption:', err)
  }
}

/** Adds credit (e.g. from a Returns refund-to-credit decision). Not atomic-guarded (never fails, only ever increments). */
export async function grantStoreCredit(payload: Payload, customerId: string | number, amount: number): Promise<void> {
  const pool = getPool(payload)
  if (pool) {
    try {
      await pool.query('UPDATE customers SET store_credit = store_credit + $1 WHERE id = $2', [amount, customerId])
      return
    } catch (err) {
      console.error('[store-credit] Atomic grant failed, falling back to read-modify-write:', err)
    }
  }
  const current = await payload.findByID({ collection: 'customers', id: customerId, depth: 0 })
  const balance = Number(current.storeCredit) || 0
  await payload.update({ collection: 'customers', id: customerId, data: { storeCredit: balance + amount } })
}
