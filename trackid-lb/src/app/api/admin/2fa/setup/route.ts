import { getPayload } from '@/lib/payload'
import { requireStaffUser } from '@/lib/access'
import { durableRateLimit } from '@/lib/durable-rate-limit'
import { clientIp } from '@/lib/api-guards'
import { generateTotpSecret, buildOtpauthUri, generateQrCodeDataUri } from '@/lib/totp'
import { NextRequest, NextResponse } from 'next/server'

// Step 1 of opt-in TOTP enrollment (ROADMAP F0 §1.6 follow-up): mints a new
// secret and stores it as *pending* (not yet twoFactorEnabled) so a QR scan
// that's abandoned mid-flow never silently turns 2FA on with a secret the
// admin never actually confirmed reading correctly.
export async function POST(req: NextRequest) {
  const payload = await getPayload()
  if (!(await durableRateLimit(payload, `2fa-setup:${clientIp(req)}`, 10, 10 * 60_000))) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 })
  }

  const staff = await requireStaffUser(payload, req)
  if (!staff) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const secret = generateTotpSecret()
  const otpauthUri = buildOtpauthUri(secret, staff.email)
  const qrCodeDataUri = await generateQrCodeDataUri(otpauthUri)

  await payload.update({
    collection: 'users',
    id: staff.user.id,
    data: { twoFactorPendingSecret: secret },
    overrideAccess: true,
  })

  return NextResponse.json({ secret, qrCodeDataUri })
}
