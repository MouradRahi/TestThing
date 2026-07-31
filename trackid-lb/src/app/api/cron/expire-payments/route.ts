import { getPayload } from '@/lib/payload'
import { NextRequest, NextResponse } from 'next/server'

// Releases stock reserved by online-payment orders that never completed
// (abandoned checkout, declined card with no retry) — ROADMAP F1 §2.1's
// "stock reservation with TTL" half. Same auth pattern as cleanup-carts.
//
// ⚠️ Cadence caveat: PAYMENT_RESERVATION_MINUTES defaults to 45, but Vercel's
// Hobby plan only allows daily cron invocations (the same constraint that
// made cleanup-carts daily) — so in practice a reservation isn't released
// within its nominal TTL, only "eventually, at most once a day" until this
// runs on Vercel Pro (or an external scheduler hitting this route more
// often). Acceptable for now since the only live provider is the mock
// adapter; revisit before real payment volume exists.
function authorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayload()
  const now = new Date().toISOString()

  const { docs: expired } = await payload.find({
    collection: 'orders',
    where: {
      and: [{ paymentStatus: { equals: 'awaiting_payment' } }, { paymentExpiresAt: { less_than: now } }],
    },
    limit: 200,
    depth: 0,
  })

  let cancelled = 0
  for (const order of expired) {
    try {
      // orderStatus → cancelled triggers the existing restock + status-email
      // hooks (src/collections/Orders.ts) — one place owns "what happens when
      // an order is cancelled" regardless of why.
      await payload.update({
        collection: 'orders',
        id: order.id,
        data: { orderStatus: 'cancelled', paymentStatus: 'expired' },
      })
      await payload.update({
        collection: 'payments',
        where: { and: [{ order: { equals: order.id } }, { status: { equals: 'initiated' } }] },
        data: { status: 'expired' },
      })
      cancelled++
    } catch (err) {
      console.error(`[cron] Failed to expire order ${order.id}:`, err)
    }
  }

  return NextResponse.json({ ok: true, cancelled })
}
