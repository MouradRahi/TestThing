import { getPayload } from '@/lib/payload'
import { resolveDiscount } from '@/lib/discounts'
import { rateLimit, clientIp } from '@/lib/api-guards'
import { NextRequest, NextResponse } from 'next/server'

// Live checkout feedback: given a code + cart subtotal, return whether it's
// valid and the amount off. Display-only — the orders API recomputes and is
// authoritative, so this can't be abused to actually change a price.
export async function POST(req: NextRequest) {
  if (!rateLimit(`discount:${clientIp(req)}`, 20, 10 * 60_000)) {
    return NextResponse.json({ ok: false, error: 'Too many attempts. Please wait a moment.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
  }

  const subtotal = Number(body.subtotal)
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return NextResponse.json({ ok: false, error: 'Invalid cart total' }, { status: 400 })
  }

  const payload = await getPayload()
  const result = await resolveDiscount(payload, body.code, subtotal)

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 })
  }
  return NextResponse.json({
    ok: true,
    code: result.code,
    type: result.type,
    value: result.value,
    amount: result.amount,
  })
}
