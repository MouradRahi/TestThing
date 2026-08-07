import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { clientIp, EMAIL_RE } from '@/lib/api-guards'
import { durableRateLimit } from '@/lib/durable-rate-limit'
import { totalStock } from '@/lib/stock'

// "Notify me" signup (ROADMAP Part 6.4) — public (no login required to ask
// to be notified), but only accepted for products that are actually fully
// sold out right now.
export async function POST(req: NextRequest) {
  const payload = await getPayload()
  if (!(await durableRateLimit(payload, `back-in-stock:${clientIp(req)}`, 10, 10 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const productId = Number(body.productId)
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!Number.isInteger(productId)) return NextResponse.json({ error: 'Invalid product.' }, { status: 400 })
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })

  const product = await payload.findByID({ collection: 'products', id: productId, depth: 0 }).catch(() => null)
  if (!product || product.status !== 'published') {
    return NextResponse.json({ error: 'Product not found.' }, { status: 404 })
  }
  if (totalStock(product) > 0) {
    return NextResponse.json({ error: 'This product is currently in stock.' }, { status: 400 })
  }

  const { totalDocs: existing } = await payload.count({
    collection: 'back-in-stock-requests',
    where: { and: [{ product: { equals: productId } }, { email: { equals: email } }, { notifiedAt: { exists: false } }] },
  })
  if (existing === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { user } = await payload.auth({ headers: req.headers }).catch(() => ({ user: null as any }))
    const customerId = user && (user as { collection?: string }).collection === 'customers' ? user.id : undefined
    await payload.create({
      collection: 'back-in-stock-requests',
      data: { product: productId, email, customer: customerId },
      overrideAccess: true,
    })
  }

  return NextResponse.json({ ok: true })
}
