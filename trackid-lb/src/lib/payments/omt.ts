import crypto from 'crypto'
import type { Payload } from 'payload'
import type { PaymentEvent, PaymentInitiateResult, PaymentOrderContext, PaymentProvider, PaymentStatus } from './types'

// OMT pay-at-branch voucher flow (ROADMAP F2 §2.4) — v1 ships as "voucher + manual
// confirm" because OMT's e-commerce APIs are gated behind a B2B agreement that
// doesn't exist yet. The customer gets a code + instructions at checkout, pays
// cash at any OMT branch, and staff confirm the payment by hand from the
// "OMT Payments" admin dashboard panel (src/components/admin/OmtPaymentsPanel.tsx)
// — that action calls applyPaymentEvent() through the same code path a real
// webhook would, so upgrading to API confirmation later only means adding a real
// handleWebhook()/verify() here; nothing about the order flow changes.
function generateVoucherCode(): string {
  // 8 random digits, grouped for readability — the code a customer reads aloud
  // or writes down at a branch counter, not a UUID.
  const digits = crypto.randomInt(0, 100_000_000).toString().padStart(8, '0')
  return `${digits.slice(0, 4)}-${digits.slice(4)}`
}

export const omtProvider: PaymentProvider = {
  key: 'omt',
  label: 'OMT (pay at branch)',

  async initiate(_payload: Payload, _order: PaymentOrderContext): Promise<PaymentInitiateResult> {
    const code = generateVoucherCode()
    return {
      kind: 'voucher',
      code,
      instructions: 'Show this code at any OMT branch and pay in cash.',
      providerRef: code,
    }
  },

  async handleWebhook(): Promise<PaymentEvent> {
    // No real OMT webhook exists yet (B2B-agreement-gated) — confirmation in v1
    // only ever happens via the admin "Mark as Paid" action
    // (src/lib/payments/service.ts → markPaymentPaidManually), which calls
    // applyPaymentEvent() directly and never routes through this method.
    throw new Error('OMT webhook confirmation is not available in v1 — use the admin "Mark as Paid" action.')
  },

  async verify(payload: Payload, providerRef: string): Promise<PaymentStatus> {
    const { docs } = await payload.find({
      collection: 'payments',
      where: { providerRef: { equals: providerRef } },
      limit: 1,
      depth: 0,
    })
    const doc = docs[0]
    if (!doc) throw new Error(`No OMT payment found for voucher ${providerRef}`)
    return doc.status as PaymentStatus
  },
}
