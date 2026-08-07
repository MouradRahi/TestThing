import { getPayload } from '@/lib/payload'
import { setAuthCookie } from '@/lib/auth'
import { clientIp, isStrongPassword, PASSWORD_STRENGTH_MESSAGE } from '@/lib/api-guards'
import { durableRateLimit } from '@/lib/durable-rate-limit'
import { NextRequest, NextResponse } from 'next/server'

// Changes the logged-in customer's password. Requires the current password
// (re-verified via a real login attempt, not just trusting the session) so a
// hijacked or shared session can't silently lock the real owner out.
export async function POST(req: NextRequest) {
  const payload = await getPayload()
  if (!(await durableRateLimit(payload, `change-password:${clientIp(req)}`, 10, 10 * 60_000))) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 })
  }

  const { user } = await payload.auth({ headers: req.headers })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!user || (user as any).collection !== 'customers') {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const email = (user as any).email as string

  const body = await req.json().catch(() => ({}))
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''

  if (!currentPassword) {
    return NextResponse.json({ error: 'Enter your current password.' }, { status: 400 })
  }
  if (!isStrongPassword(newPassword)) {
    return NextResponse.json({ error: PASSWORD_STRENGTH_MESSAGE }, { status: 400 })
  }

  try {
    await payload.login({ collection: 'customers', data: { email, password: currentPassword } })
  } catch {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 })
  }

  try {
    await payload.update({
      collection: 'customers',
      id: user.id,
      data: { password: newPassword },
      overrideAccess: true,
    })
    // Re-login to issue a fresh token/cookie (matches register/reset behavior).
    const result = await payload.login({ collection: 'customers', data: { email, password: newPassword } })
    const res = NextResponse.json({ ok: true })
    if (result.token) setAuthCookie(res, result.token)
    return res
  } catch {
    return NextResponse.json({ error: 'Could not change your password. Please try again.' }, { status: 500 })
  }
}
