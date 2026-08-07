import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { clientIp, cleanString } from '@/lib/api-guards'
import { durableRateLimit } from '@/lib/durable-rate-limit'

// Customer-submitted review (ROADMAP Part 6.2). One review per
// customer+product (a second submission is rejected, not upserted — keeps
// the "did they actually buy it" verified-purchase computation simple and
// avoids someone farming multiple reviews for the same item).
const MAX_TEXT_LEN = 2000

export async function POST(req: NextRequest) {
  const payload = await getPayload()
  if (!(await durableRateLimit(payload, `reviews:${clientIp(req)}`, 10, 10 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  const { user } = await payload.auth({ headers: req.headers })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!user || (user as any).collection !== 'customers') {
    return NextResponse.json({ error: 'Please sign in to write a review.' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const productId = Number(body.productId)
  const rating = Number(body.rating)
  const text = cleanString(body.text, MAX_TEXT_LEN)

  if (!Number.isInteger(productId)) return NextResponse.json({ error: 'Invalid product.' }, { status: 400 })
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be 1–5.' }, { status: 400 })
  }
  if (!text) return NextResponse.json({ error: 'Please write a few words about the piece.' }, { status: 400 })

  const product = await payload.findByID({ collection: 'products', id: productId, depth: 0 }).catch(() => null)
  if (!product || product.status !== 'published') {
    return NextResponse.json({ error: 'Product not found.' }, { status: 404 })
  }

  const { totalDocs: existing } = await payload.count({
    collection: 'reviews',
    where: { and: [{ product: { equals: productId } }, { customer: { equals: user.id } }] },
  })
  if (existing > 0) {
    return NextResponse.json({ error: "You've already reviewed this product." }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerName = (user as any).name || 'Customer'
  const { totalDocs: deliveredWithProduct } = await payload.count({
    collection: 'orders',
    where: {
      and: [
        { customer: { equals: user.id } },
        { orderStatus: { equals: 'delivered' } },
        { 'items.productId': { equals: String(productId) } },
      ],
    },
  })

  const created = await payload.create({
    collection: 'reviews',
    data: {
      product: productId,
      customer: user.id,
      customerName,
      rating,
      text,
      verifiedPurchase: deliveredWithProduct > 0,
      status: 'pending',
    },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true, reviewId: created.id })
}
