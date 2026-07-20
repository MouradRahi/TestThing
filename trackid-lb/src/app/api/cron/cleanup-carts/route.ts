import { getPayload } from '@/lib/payload'
import { NextRequest, NextResponse } from 'next/server'

const STALE_DAYS = 90

// Deletes abandoned GUEST carts (a sessionId, no linked customer) that
// haven't changed in STALE_DAYS. The `cart-session` cookie itself expires
// after CART_COOKIE_MAX_AGE (60 days, cart-server.ts), but the DB row
// outlives it forever without this sweep — unbounded growth on a free-tier
// Postgres from every anonymous visitor who ever added to cart.
//
// Scheduled via vercel.json (daily). When CRON_SECRET is set, Vercel signs
// the invocation with an `Authorization: Bearer <secret>` header automatically
// — this route just has to check it matches.
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
  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const result = await payload.delete({
    collection: 'carts',
    where: {
      and: [{ sessionId: { exists: true } }, { customer: { exists: false } }, { updatedAt: { less_than: cutoff } }],
    },
  })
  const deleted = Array.isArray(result?.docs) ? result.docs.length : 0

  return NextResponse.json({ ok: true, deleted })
}
