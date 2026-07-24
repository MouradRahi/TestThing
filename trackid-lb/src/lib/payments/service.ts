import type { Payload } from 'payload'
import type { PaymentEvent, PaymentInitiateResult, PaymentOrderContext, PaymentStatus } from './types'
import { getProvider } from './registry'

// How long stock stays reserved on an unpaid online-payment order before the
// expiry cron releases it. Overridable for testing; 30–60 min is the
// roadmap's suggested range for a real checkout session.
export const PAYMENT_EXPIRY_MINUTES = Number(process.env.PAYMENT_RESERVATION_MINUTES) || 45

export function paymentExpiryDate(): string {
  return new Date(Date.now() + PAYMENT_EXPIRY_MINUTES * 60_000).toISOString()
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

  // 'refunded' is F2 (refunds/reconciliation) territory — recorded on the
  // payment above; order-level handling lands with the admin refund flow.
  if (event.status === 'paid' || event.status === 'failed') {
    await payload.update({
      collection: 'orders',
      id: payment.order as string | number,
      data: { paymentStatus: event.status },
    })
  }

  return { ok: true, alreadyProcessed: false }
}
