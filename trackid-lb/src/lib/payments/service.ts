import type { Payload } from 'payload'
import type { PaymentEvent, PaymentInitiateResult, PaymentOrderContext, PaymentStatus } from './types'
import { getProvider } from './registry'

// How long stock stays reserved on an unpaid online-payment order before the
// expiry cron releases it. Overridable for testing; 30–60 min is the
// roadmap's suggested range for a real hosted-checkout session.
export const PAYMENT_EXPIRY_MINUTES = Number(process.env.PAYMENT_RESERVATION_MINUTES) || 45

// OMT vouchers need a much longer window than a card session — the customer
// has to physically travel to a branch (ROADMAP F2 §2.4).
export const OMT_RESERVATION_HOURS = Number(process.env.OMT_RESERVATION_HOURS) || 48

export function paymentExpiryDate(minutes: number = PAYMENT_EXPIRY_MINUTES): string {
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

/**
 * Creates the Payments record and kicks off the provider's session. Stock for
 * the order must already be reserved (decremented) by the caller — this only
 * handles the payment side. Throws if the provider rejects (caller rolls back
 * the order/stock/discount it already committed).
 */
export async function initiatePayment(
  payload: Payload,
  providerKey: string,
  order: PaymentOrderContext,
): Promise<PaymentInitiateResult> {
  const provider = getProvider(providerKey)
  if (!provider) throw new Error(`Unknown payment provider: ${providerKey}`)

  const result = await provider.initiate(payload, order)

  await payload.create({
    collection: 'payments',
    data: {
      order: Number(order.orderId),
      // Cast needed until a second provider exists — Payments.provider's
      // select options (src/collections/Payments.ts) narrow the generated
      // type to the currently-registered keys; add the option there first.
      provider: providerKey as 'mock',
      providerRef: result.providerRef,
      amount: order.amount,
      currency: order.currency,
      status: 'initiated',
    },
  })

  return result
}

/**
 * Applies a verified webhook event to its Payment + Order records. Security
 * invariants (ROADMAP F1 §2.1): amount is re-checked against our own record
 * (never trust what the webhook claims alone), and processing is idempotent —
 * a webhook delivered twice for an already-settled payment is a no-op rather
 * than double-firing confirmation emails or flipping state twice.
 *
 * Only sets Payment/Order status here — notifications on the paid transition
 * are handled by an Orders afterChange hook (src/collections/Orders.ts), so
 * "what happens when an order becomes paid" has one source of truth
 * regardless of which provider (or future admin override) got it there.
 */
export async function applyPaymentEvent(
  payload: Payload,
  event: PaymentEvent,
): Promise<{ ok: true; alreadyProcessed: boolean } | { ok: false; error: string }> {
  const { docs } = await payload.find({
    collection: 'payments',
    where: { providerRef: { equals: event.providerRef } },
    limit: 1,
    depth: 0,
  })
  const payment = docs[0]
  if (!payment) return { ok: false, error: 'Unknown payment reference' }

  const terminal: PaymentStatus[] = ['paid', 'failed', 'expired', 'refunded', 'partially_refunded']
  if (terminal.includes(payment.status as PaymentStatus)) {
    if (payment.status !== event.status) {
      console.error(
        `[payments] Ignoring "${event.status}" event for payment ${payment.id} — already "${payment.status}"`,
      )
    }
    return { ok: true, alreadyProcessed: true }
  }

  if (event.amount != null && Math.abs(event.amount - Number(payment.amount)) > 0.01) {
    console.error(
      `[payments] Amount mismatch on payment ${payment.id}: expected ${payment.amount}, event said ${event.amount}`,
    )
    return { ok: false, error: 'Amount mismatch' }
  }

  const rawEvents = Array.isArray(payment.rawEvents) ? payment.rawEvents : []
  await payload.update({
    collection: 'payments',
    id: payment.id,
    data: { status: event.status, rawEvents: [...rawEvents, event.raw] },
  })

  // 'refunded' events aren't emitted by any provider yet — refunds go through
  // processRefund() below instead, which updates both records directly.
  if (event.status === 'paid' || event.status === 'failed') {
    await payload.update({
      collection: 'orders',
      id: payment.order as string | number,
      data: { paymentStatus: event.status },
    })
  }

  return { ok: true, alreadyProcessed: false }
}

/**
 * OMT v1's "manual confirm" fallback (ROADMAP F2 §2.4) — staff confirm a
 * branch cash payment from the admin "OMT Payments" dashboard panel. Routes
 * through the exact same applyPaymentEvent() a real webhook would use, so the
 * idempotency/terminal-state guard applies here too (double-clicking "Mark as
 * Paid" is harmless) and the Orders paid-transition hook (confirmation
 * email/WhatsApp) fires the same way regardless of how the order got paid.
 */
export async function markPaymentPaidManually(
  payload: Payload,
  orderId: string | number,
  adminEmail: string,
): Promise<{ ok: true; alreadyProcessed: boolean } | { ok: false; error: string }> {
  const { docs } = await payload.find({
    collection: 'payments',
    where: { order: { equals: orderId } },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
  })
  const payment = docs[0]
  if (!payment) return { ok: false, error: 'No payment record found for this order.' }

  return applyPaymentEvent(payload, {
    providerRef: payment.providerRef as string,
    status: 'paid',
    raw: { source: 'manual-admin-confirm', confirmedBy: adminEmail, confirmedAt: new Date().toISOString() },
  })
}

// Mirrors the restock logic in Orders.ts's cancel hook / orders/route.ts's
// restoreStock — duplicated rather than shared to avoid touching the
// already-verified F1 checkout path for a refund-only feature. Read-modify-
// write (not the atomic SQL pool version) is fine here: refunds are rare,
// staff-initiated actions, not a high-concurrency checkout path.
async function restockOrderItems(payload: Payload, items: unknown): Promise<void> {
  const lines: Array<{ productId?: string; quantity?: number; size?: string | null }> = Array.isArray(items)
    ? (items as Array<{ productId?: string; quantity?: number; size?: string | null }>)
    : []
  for (const item of lines) {
    const id = Number(item.productId)
    const quantity = Number(item.quantity)
    if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1) continue
    try {
      const product = await payload.findByID({ collection: 'products', id, depth: 0 })
      if (item.size && Array.isArray(product.sizes)) {
        const sizes = [...product.sizes]
        const idx = sizes.findIndex((s: { label?: string }) => s?.label === item.size)
        if (idx < 0) continue
        sizes[idx] = { ...sizes[idx], stockQuantity: (sizes[idx].stockQuantity ?? 0) + quantity }
        await payload.update({ collection: 'products', id, data: { sizes } })
      } else {
        const current = typeof product.stockQuantity === 'number' ? product.stockQuantity : 0
        await payload.update({ collection: 'products', id, data: { stockQuantity: current + quantity } })
      }
    } catch (err) {
      console.error(`[payments] Failed to restock product ${item.productId} after refund:`, err)
    }
  }
}

export type RefundResult =
  | { ok: true; refundedAmount: number; paymentStatus: 'refunded' | 'partially_refunded' }
  | { ok: false; error: string }

/**
 * Admin refund action (ROADMAP F2 §2.6) — works for every payment method,
 * not just online ones: COD/bank-transfer orders have no Payment record
 * (money moved outside this system), so a refund there just updates the
 * Order's own bookkeeping; card/OMT orders additionally update their Payment
 * record. `Orders.refundedAmount` is the single source of truth for "how
 * much has come back" regardless of provider. Restocking (if requested)
 * always restocks the full order — partial per-item restock on a partial
 * refund is a real gap, deferred to Part 6 (returns/RMA), which needs
 * item-level selection anyway.
 */
export async function processRefund(
  payload: Payload,
  params: { orderId: string | number; amount: number; restock: boolean; adminEmail: string },
): Promise<RefundResult> {
  const order = await payload.findByID({ collection: 'orders', id: params.orderId, depth: 0 }).catch(() => null)
  if (!order) return { ok: false, error: 'Order not found.' }

  const currentStatus = order.paymentStatus as string
  if (currentStatus !== 'paid' && currentStatus !== 'partially_refunded') {
    return { ok: false, error: `Cannot refund an order with payment status "${currentStatus}".` }
  }

  const total = Number(order.total) || 0
  const alreadyRefunded = Number(order.refundedAmount) || 0
  const remaining = Math.round((total - alreadyRefunded) * 100) / 100
  const amount = Math.round(params.amount * 100) / 100

  if (!(amount > 0)) return { ok: false, error: 'Refund amount must be greater than zero.' }
  if (amount > remaining + 0.01) {
    return { ok: false, error: `Refund amount exceeds the remaining refundable balance ($${remaining.toFixed(2)}).` }
  }

  const newRefundedAmount = Math.round((alreadyRefunded + amount) * 100) / 100
  const newPaymentStatus: 'refunded' | 'partially_refunded' = newRefundedAmount >= total - 0.01 ? 'refunded' : 'partially_refunded'

  // Provider-side refund where supported — no adapter implements one yet
  // (mock/OMT both record manually), but the hook exists so a real gateway
  // can plug in later without changing this function's shape.
  const { docs: payments } = await payload.find({
    collection: 'payments',
    where: { order: { equals: params.orderId } },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
  })
  const payment = payments[0]
  if (payment) {
    const provider = getProvider(payment.provider as string)
    if (provider?.refund) await provider.refund(payload, payment, amount)

    const rawEvents = Array.isArray(payment.rawEvents) ? payment.rawEvents : []
    await payload.update({
      collection: 'payments',
      id: payment.id,
      data: {
        status: newPaymentStatus,
        rawEvents: [
          ...rawEvents,
          { source: 'manual-admin-refund', amount, adminEmail: params.adminEmail, at: new Date().toISOString() },
        ],
      },
    })
  }

  await payload.update({
    collection: 'orders',
    id: params.orderId,
    data: { refundedAmount: newRefundedAmount, paymentStatus: newPaymentStatus },
  })

  if (params.restock) await restockOrderItems(payload, order.items)

  return { ok: true, refundedAmount: newRefundedAmount, paymentStatus: newPaymentStatus }
}
