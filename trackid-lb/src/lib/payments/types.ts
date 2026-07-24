import type { Payload } from 'payload'

// ROADMAP F1 §2.1 — provider-agnostic payment abstraction. A brand toggles a
// provider on from SiteSettings; adding a new one (Areeba, NetCommerce, Whish
// if it's ever revisited) means writing one adapter against this interface,
// not touching checkout/orders/cron code. Only the `mock` adapter exists so
// far (Session F1) — real vendor onboarding is still pending.

export type PaymentStatus =
  | 'initiated'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'refunded'
  | 'partially_refunded'

/** What initiate() hands back to the checkout flow. */
export type PaymentInitiateResult =
  | { kind: 'redirect'; url: string; providerRef: string }
  | { kind: 'voucher'; code: string; instructions: string; providerRef: string }

/** A normalized inbound event after signature verification. */
export type PaymentEvent = {
  providerRef: string
  status: 'paid' | 'failed' | 'refunded'
  /** Amount/currency the provider says was paid, when it tells us — re-checked against our own record. */
  amount?: number
  currency?: string
  raw: unknown
}

export type PaymentOrderContext = {
  orderId: string | number
  orderNumber: string
  /** USD — the money of record. */
  amount: number
  currency: string
  customerEmail?: string | null
  locale?: string
}

export interface PaymentProvider {
  key: string
  label: string
  /**
   * Kick off a payment attempt. For a hosted-checkout gateway this is the
   * server-to-server call that opens a session; for the mock adapter it just
   * mints a local reference. Never throws for "declined" — that only happens
   * later via handleWebhook/verify.
   */
  initiate(payload: Payload, order: PaymentOrderContext): Promise<PaymentInitiateResult>
  /**
   * Parse + verify an inbound webhook request (signature, shape). Throws on a
   * bad/missing signature — the route returns 400 without acting on it.
   */
  handleWebhook(req: Request, rawBody: string): Promise<PaymentEvent>
  /**
   * Server-to-server status poll, independent of any webhook. Real adapters
   * call the provider's API; the mock adapter reads back its own Payments
   * record (there's no external system to ask).
   */
  verify(payload: Payload, providerRef: string): Promise<PaymentStatus>
}
