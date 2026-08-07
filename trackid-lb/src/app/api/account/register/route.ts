import { getPayload } from '@/lib/payload'
import { setAuthCookie } from '@/lib/auth'
import { CART_COOKIE, mergeGuestCart } from '@/lib/cart-server'
import { clientIp, cleanString, cleanOptional, EMAIL_RE, isStrongPassword, PASSWORD_STRENGTH_MESSAGE } from '@/lib/api-guards'
import { durableRateLimit } from '@/lib/durable-rate-limit'
import { resolveLoyaltyConfig, grantPoints } from '@/lib/loyalty'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const payload = await getPayload()
  if (!(await durableRateLimit(payload, `register:${clientIp(req)}`, 5, 10 * 60_000))) {
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
  if (!isStrongPassword(password)) {
    return NextResponse.json({ error: PASSWORD_STRENGTH_MESSAGE }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase()

  // Referral capture (ROADMAP Part 6.6) — the referrer's own numeric
  // customer id is the "code" (shared as a ?ref= link from their account
  // page). Validated against a real customer here so a garbage/self-
  // referral value never gets stored; the referee's signup bonus is granted
  // immediately, the referrer's reward waits for this customer's first
  // delivered order (Orders.ts's afterChange hook).
  let referredBy: number | undefined
  const refInput = Number(body.ref)
  if (Number.isInteger(refInput) && refInput > 0) {
    const referrer = await payload.findByID({ collection: 'customers', id: refInput, depth: 0 }).catch(() => null)
    if (referrer) referredBy = refInput
  }

  let newCustomerId: number | undefined
  try {
    const created = await payload.create({
      collection: 'customers',
      data: { email: normalizedEmail, password, name, ...(phone ? { phone } : {}), ...(referredBy ? { referredBy } : {}) },
    })
    newCustomerId = Number(created.id)
  } catch {
    // Most likely a duplicate email — don't reveal which
    return NextResponse.json(
      { error: 'We couldn’t create that account. The email may already be in use.' },
      { status: 409 },
    )
  }

  if (referredBy && newCustomerId) {
    try {
      const settings = (await payload.findGlobal({ slug: 'site-settings' })) as unknown as Record<string, unknown>
      const loyalty = resolveLoyaltyConfig(settings)
      if (loyalty.enabled) {
        const refereePoints = typeof settings.referralRefereePoints === 'number' ? settings.referralRefereePoints : 100
        if (refereePoints > 0) await grantPoints(payload, newCustomerId, refereePoints)
      }
    } catch (err) {
      console.error('[register] Referral signup bonus failed (account still created fine):', err)
    }
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
