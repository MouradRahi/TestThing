import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { clientIp, cleanString } from '@/lib/api-guards'
import { durableRateLimit } from '@/lib/durable-rate-limit'

// Customer-initiated return request (ROADMAP Part 6.1). Requires a logged-in
// customer whose order this actually is — v1 scope, matching the roadmap's
// own wording ("from order history", which only logged-in customers have
// access to; a guest-order return flow would need a separate
// orderNumber+email verification step, not attempted here). Only orders
// already `delivered` are eligible. Requested quantities are checked against
// what the order actually contains, but not against quantities from any
// *prior* return request on the same order — a v1 simplification (a
// same-item double-return would need a cumulative-quantity check across all
// of an order's Returns docs, deferred).
const MAX_ITEMS = 30
const MAX_REASON_LEN = 1000

export async function POST(req: NextRequest) {
  const payload = await getPayload()
  if (!(await durableRateLimit(payload, `returns:${clientIp(req)}`, 5, 10 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  const { user } = await payload.auth({ headers: req.headers })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!user || (user as any).collection !== 'customers') {
    return NextResponse.json({ error: 'Please sign in to request a return.' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const orderId = Number(body.orderId)
  const reason = cleanString(body.reason, MAX_REASON_LEN)
  const requestedItems: Array<{ productId?: unknown; size?: unknown; quantity?: unknown }> = Array.isArray(
    body.items,
  )
    ? body.items.slice(0, MAX_ITEMS)
    : []

  if (!Number.isInteger(orderId)) return NextResponse.json({ error: 'Invalid order.' }, { status: 400 })
  if (!reason) return NextResponse.json({ error: 'Please explain why you want to return this.' }, { status: 400 })
  if (requestedItems.length === 0) {
    return NextResponse.json({ error: 'Select at least one item to return.' }, { status: 400 })
  }

  const order = await payload.findByID({ collection: 'orders', id: orderId, depth: 0 }).catch(() => null)
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })

  const orderCustomerId = typeof order.customer === 'object' ? (order.customer as { id: number })?.id : order.customer
  if (!orderCustomerId || String(orderCustomerId) !== String(user.id)) {
    return NextResponse.json({ error: 'This order does not belong to you.' }, { status: 403 })
  }
  if (order.orderStatus !== 'delivered') {
    return NextResponse.json({ error: 'Only delivered orders can be returned.' }, { status: 400 })
  }

  const orderItems: Array<{ productId: string; titleAtPurchase: string; size?: string | null; priceAtPurchase: number; quantity: number }> =
    Array.isArray(order.items) ? order.items : []

  const returnItems: Array<{
    productId: string
    titleAtPurchase: string
    size?: string
    priceAtPurchase: number
    quantity: number
  }> = []

  for (const req_ of requestedItems) {
    const productId = typeof req_.productId === 'string' ? req_.productId : ''
    const size = typeof req_.size === 'string' && req_.size ? req_.size : undefined
    const quantity = Number(req_.quantity)
    if (!productId || !Number.isInteger(quantity) || quantity < 1) {
      return NextResponse.json({ error: 'Invalid item selection.' }, { status: 400 })
    }
    const match = orderItems.find((oi) => oi.productId === productId && (oi.size ?? undefined) === size)
    if (!match) {
      return NextResponse.json({ error: 'One of the selected items is not part of this order.' }, { status: 400 })
    }
    if (quantity > match.quantity) {
      return NextResponse.json(
        { error: `You can return at most ${match.quantity} of "${match.titleAtPurchase}".` },
        { status: 400 },
      )
    }
    returnItems.push({
      productId,
      titleAtPurchase: match.titleAtPurchase,
      size,
      priceAtPurchase: match.priceAtPurchase,
      quantity,
    })
  }

  const created = await payload.create({
    collection: 'returns',
    data: {
      order: orderId,
      orderNumber: order.orderNumber,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customer: user.id,
      customerName: order.customerName,
      customerEmail: (order.customerEmail as string | undefined) || (user as unknown as { email?: string }).email || '',
      items: returnItems,
      reason,
      status: 'requested',
    },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true, returnId: created.id })
}
