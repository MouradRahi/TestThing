import { getPayload } from '@/lib/payload'
import { setAuthCookie } from '@/lib/auth'
import { CART_COOKIE, mergeGuestCart } from '@/lib/cart-server'
import { rateLimit, clientIp, cleanString } from '@/lib/api-guards'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  if (!rateLimit(`login:${clientIp(req)}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const email = cleanString(body?.email, 160)
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!email || !password) {
    return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 })
  }

  const payload = await getPayload()
  try {
    const result = await payload.login({
      collection: 'customers',
      data: { email: email.toLowerCase(), password },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = result.user as any
    // Fold the guest cart into this account
    await mergeGuestCart(payload, req.cookies.get(CART_COOKIE)?.value, user.id)
    const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } })
    if (result.token) setAuthCookie(res, result.token)
    return res
  } catch {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }
}
