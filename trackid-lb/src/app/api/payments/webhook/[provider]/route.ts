import { getPayload } from '@/lib/payload'
import { getProvider } from '@/lib/payments/registry'
import { applyPaymentEvent } from '@/lib/payments/service'
import { durableRateLimit } from '@/lib/durable-rate-limit'
import { clientIp } from '@/lib/api-guards'
import { reportServerError } from '@/lib/error-reporting'
import { NextRequest, NextResponse } from 'next/server'

// Provider webhooks land here (ROADMAP F1 §2.1) — one path per provider so
// each adapter's own request shape/signature scheme stays isolated. Security
// invariants live in the provider's handleWebhook() (signature verification)
// and applyPaymentEvent() (replay protection, amount re-check, idempotent
// processing) — this route is just the HTTP shell around both.
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const { provider: providerKey } = await params
    const provider = getProvider(providerKey)
    if (!provider) return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })

    const payload = await getPayload()
    if (!(await durableRateLimit(payload, `payment-webhook:${clientIp(req)}`, 30, 10 * 60_000))) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const rawBody = await req.text()
    let event
    try {
      event = await provider.handleWebhook(req, rawBody)
    } catch (err) {
      console.error(`[payments] Webhook verification failed for ${providerKey}:`, err)
      return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 })
    }

    const result = await applyPaymentEvent(payload, event)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true, alreadyProcessed: result.alreadyProcessed })
  } catch (err) {
    console.error('[payments] Webhook processing failed:', err)
    reportServerError(err, { route: 'payments-webhook' })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
