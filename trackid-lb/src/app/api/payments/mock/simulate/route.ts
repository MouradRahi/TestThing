import { mockPaymentsAllowed, signMockPayload } from '@/lib/payments/mock'
import { NextRequest, NextResponse } from 'next/server'

// Backs the /pay/mock testing page's "simulate payment" buttons. Deliberately
// round-trips through the real webhook route (with a real signature) instead
// of calling applyPaymentEvent directly — that way the mock adapter actually
// exercises the same signature-verification + idempotency path a real
// provider's webhook would hit, not a shortcut around it.
export async function POST(req: NextRequest) {
  if (!mockPaymentsAllowed()) {
    return NextResponse.json({ error: 'Mock payments are disabled' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const providerRef = typeof body?.providerRef === 'string' ? body.providerRef : null
  const outcome = body?.outcome === 'success' ? 'success' : 'failure'
  if (!providerRef) return NextResponse.json({ error: 'Missing providerRef' }, { status: 400 })

  const rawBody = JSON.stringify({ providerRef, outcome })
  const signature = signMockPayload(rawBody)

  const webhookUrl = new URL('/api/payments/webhook/mock', req.url)
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-mock-signature': signature },
    body: rawBody,
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
