import { getPayload } from '@/lib/payload'
import { setAuthCookie } from '@/lib/auth'
import { CART_COOKIE, mergeGuestCart } from '@/lib/cart-server'
import { rateLimit, clientIp, cleanString, cleanOptional, EMAIL_RE } from '@/lib/api-guards'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  if (!rateLimit(`register:${clientIp(req)}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const name = cleanString(body.name, 120)
  const email = cleanString(body.email, 160)
  const phone = cleanOptional(body.phone, 40)
  const password = typeof body.password === 'string' ? body.password : ''

  if (!name || !email || phone === null) {
    return NextResponse.json({ error: 'Please fill in your name and email.' }, { status: 400 })
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const payload = await getPayload()
  const normalizedEmail = email.toLowerCase()

  try {
    await payload.create({
      collection: 'customers',
      data: { email: normalizedEmail, password, name, ...(phone ? { phone } : {}) },
    })
  } catch {
    // Most likely a duplicate email — don't reveal which
    return NextResponse.json(
      { error: 'We couldn’t create that account. The email may already be in use.' },
      { status: 409 },
    )
  }

  try {
    const result = await payload.login({
      collection: 'customers',
      data: { email: normalizedEmail, password },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = result.user as any
    await mergeGuestCart(payload, req.cookies.get(CART_COOKIE)?.value, user.id)
    const res = NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name } },
      { status: 201 },
    )
    if (result.token) setAuthCookie(res, result.token)
    return res
  } catch {
    // Account was created but auto-login failed — let them log in manually
    return NextResponse.json({ ok: true, requiresLogin: true }, { status: 201 })
  }
}
