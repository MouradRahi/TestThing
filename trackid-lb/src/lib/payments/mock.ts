import crypto from 'crypto'
import type { Payload } from 'payload'
import type { PaymentEvent, PaymentInitiateResult, PaymentOrderContext, PaymentProvider, PaymentStatus } from './types'

// Local-testing adapter — simulates a hosted-checkout redirect + webhook
// round trip with no real money involved, so the abstraction (2.1) can be
// built and exercised end-to-end before a real vendor account exists. Swap
// in Areeba/NetCommerce later by registering another PaymentProvider; nothing
// else in checkout/orders/cron changes (see registry.ts).
//
// Guarded off in production unless explicitly opted into — this is testing
// infra, not a real settlement path, and must never look like one to a real
// customer on the live site.
export function mockPaymentsAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_MOCK_PAYMENTS === 'true'
}

function secret(): string {
  return process.env.MOCK_PAYMENT_SECRET || 'dev-only-mock-payment-secret'
}

export function signMockPayload(rawBody: string): string {
  return crypto.createHmac('sha256', secret()).update(rawBody).digest('hex')
}

export const mockProvider: PaymentProvider = {
  key: 'mock',
  label: 'Mock (testing)',

  async initiate(_payload: Payload, order: PaymentOrderContext): Promise<PaymentInitiateResult> {
    if (!mockPaymentsAllowed()) {
      throw new Error('Mock payments are disabled in production. Set ALLOW_MOCK_PAYMENTS=true to test them here.')
    }
    const providerRef = crypto.randomUUID()
    return { kind: 'redirect', url: `/pay/mock/${providerRef}`, providerRef }
  },

  async handleWebhook(req: Request, rawBody: string): Promise<PaymentEvent> {
    const signature = req.headers.get('x-mock-signature') || ''
    const expected = signMockPayload(rawBody)
    // timingSafeEqual requires equal-length buffers — bail out early on a
    // length mismatch rather than let it throw.
    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expected)
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      throw new Error('Invalid mock payment signature')
    }
    const body = JSON.parse(rawBody) as { providerRef?: string; outcome?: string }
    if (!body.providerRef || typeof body.providerRef !== 'string') {
      throw new Error('Missing providerRef in mock webhook body')
    }
    return {
      providerRef: body.providerRef,
      status: body.outcome === 'success' ? 'paid' : 'failed',
      raw: body,
    }
  },

  async verify(payload: Payload, providerRef: string): Promise<PaymentStatus> {
    const { docs } = await payload.find({
      collection: 'payments',
      where: { providerRef: { equals: providerRef } },
      limit: 1,
      depth: 0,
    })
    const doc = docs[0]
    if (!doc) throw new Error(`No mock payment found for ref ${providerRef}`)
    return doc.status as PaymentStatus
  },
}
