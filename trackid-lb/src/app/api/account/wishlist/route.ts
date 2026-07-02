import { getPayload } from '@/lib/payload'
import { rateLimit, clientIp } from '@/lib/api-guards'
import { safeRevalidatePath } from '@/lib/revalidate'
import { NextRequest, NextResponse } from 'next/server'

// Current wishlist state for a product — lets the product page stay static while
// the button resolves login + saved state client-side on mount.
export async function GET(req: NextRequest) {
  const productId = Number(new URL(req.url).searchParams.get('productId'))
  const payload = await getPayload()
  const { user } = await payload.auth({ headers: req.headers })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!user || (user as any).collection !== 'customers') {
    return NextResponse.json({ isLoggedIn: false, inWishlist: false })
  }
  const current = await payload.findByID({ collection: 'customers', id: user.id, depth: 0 })
  const wishlist = Array.isArray(current.wishlist) ? current.wishlist.map(Number) : []
  return NextResponse.json({ isLoggedIn: true, inWishlist: wishlist.includes(productId) })
}

// Toggle a product in the logged-in customer's wishlist (server-backed — no localStorage).
export async function POST(req: NextRequest) {
  if (!rateLimit(`wishlist:${clientIp(req)}`, 40, 10 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  const payload = await getPayload()
  const { user } = await payload.auth({ headers: req.headers })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!user || (user as any).collection !== 'customers') {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const productId = Number(body.productId)
  if (!Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json({ error: 'Invalid product.' }, { status: 400 })
  }

  const current = await payload.findByID({ collection: 'customers', id: user.id, depth: 0 })
  const wishlist = Array.isArray(current.wishlist) ? current.wishlist.map(Number) : []
  const has = wishlist.includes(productId)
  const next = has ? wishlist.filter((id) => id !== productId) : [...wishlist, productId]

  await payload.update({ collection: 'customers', id: user.id, data: { wishlist: next }, overrideAccess: true })
  safeRevalidatePath('/account')
  return NextResponse.json({ ok: true, inWishlist: !has })
}
