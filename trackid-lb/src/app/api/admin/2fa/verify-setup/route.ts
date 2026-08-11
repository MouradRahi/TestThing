import { getPayload } from '@/lib/payload'
import { requireStaffUser } from '@/lib/access'
import { durableRateLimit } from '@/lib/durable-rate-limit'
import { clientIp } from '@/lib/api-guards'
import { verifyTotpCode } from '@/lib/totp'
import { logAuditEvent } from '@/lib/audit-log'
import { NextRequest, NextResponse } from 'next/server'

// Step 2 of enrollment: proves the admin actually captured the secret (via
// the QR code or manual key) before it becomes the *live* secret checked at
// login — re-reads the pending secret fresh from the DB rather than trusting
// anything client-supplied.
export async function POST(req: NextRequest) {
  const payload = await getPayload()
  if (!(await durableRateLimit(payload, `2fa-verify-setup:${clientIp(req)}`, 10, 10 * 60_000))) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 })
  }

  const staff = await requireStaffUser(payload, req)
  if (!staff) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const code = typeof body?.code === 'string' ? body.code.trim() : ''

  const fresh = await payload.findByID({
    collection: 'users',
    id: staff.user.id,
    overrideAccess: true,
    // twoFactorPendingSecret is `hidden: true` — Payload strips hidden
    // fields from every read regardless of `select` unless this is set.
    showHiddenFields: true,
    select: { twoFactorPendingSecret: true },
  })
  const pending = fresh?.twoFactorPendingSecret
  if (!pending) {
    return NextResponse.json({ error: 'Start enrollment again — no pending code found.' }, { status: 400 })
  }
  if (!verifyTotpCode(pending, code)) {
    return NextResponse.json({ error: 'That code is incorrect or expired. Please try again.' }, { status: 400 })
  }

  await payload.update({
    collection: 'users',
    id: staff.user.id,
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: pending,
      twoFactorPendingSecret: null,
      twoFactorEnabledAt: new Date().toISOString(),
    },
    overrideAccess: true,
  })

  await logAuditEvent(payload, {
    collectionSlug: 'users',
    documentId: String(staff.user.id),
    action: 'update',
    req: { user: staff.user },
    summary: `${staff.email} enabled two-factor authentication`,
  })

  return NextResponse.json({ ok: true })
}
