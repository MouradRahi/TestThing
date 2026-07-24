import { getPayload } from '@/lib/payload'
import { durableRateLimit } from '@/lib/durable-rate-limit'
import { clientIp } from '@/lib/api-guards'
import { NextRequest, NextResponse } from 'next/server'

// Lightweight poll target for the order-confirmation page's "confirming
// payment…" banner — order numbers are unguessable tokens (same trust model
// as /track), and this only ever exposes status, never money/PII.
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) {
  const payload = await getPayload()
  if (!(await durableRateLimit(payload, `order-status:${clientIp(req)}`, 60, 5 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { orderNumber } = await params
  const { docs } = await payload.find({
    collection: 'orders',
    where: { orderNumber: { equals: orderNumber } },
    limit: 1,
    depth: 0,
    select: { paymentStatus: true, orderStatus: true },
  })
  const order = docs[0]
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ paymentStatus: order.paymentStatus, orderStatus: order.orderStatus })
}
