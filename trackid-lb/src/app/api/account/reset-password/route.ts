import { getPayload } from '@/lib/payload'
import { setAuthCookie } from '@/lib/auth'
import { CART_COOKIE, mergeGuestCart } from '@/lib/cart-server'
import { clientIp, cleanString } from '@/lib/api-guards'
import { durableRateLimit } from '@/lib/durable-rate-limit'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const payload = await getPayload()
  if (!(await durableRateLimit(payload, `reset-password:${clientIp(req)}`, 10, 10 * 60_000))) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const token = cleanString(body?.token, 200)
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!token) {
    return NextResponse.json({ error: 'This reset link is invalid or has expired.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  try {
    const result = await payload.resetPassword({
      collection: 'customers',
      data: { token, password },
      overrideAccess: true,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = result.user as any
    await mergeGuestCart(payload, req.cookies.get(CART_COOKIE)?.value, user.id)
    const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } })
    if (result.token) setAuthCookie(res, result.token)
    return res
  } catch {
    // Payload throws on an invalid/expired/already-used token — same message
    // either way, no need to distinguish for the customer.
    return NextResponse.json({ error: 'This reset link is invalid or has expired.' }, { status: 400 })
  }
}
