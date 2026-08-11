import { getPayload } from '@/lib/payload'
import { requireStaffUser, isAdmin } from '@/lib/access'
import { durableRateLimit } from '@/lib/durable-rate-limit'
import { clientIp } from '@/lib/api-guards'
import { verifyTotpCode } from '@/lib/totp'
import { logAuditEvent } from '@/lib/audit-log'
import { NextRequest, NextResponse } from 'next/server'

// Disables 2FA either for the caller's own account — requires a *current*
// TOTP code, proving continued possession of the authenticator (not the
// password: an internal `payload.login()` re-check would itself trip the
// `beforeLogin` 2FA gate on Users.ts, since a local-API login call has no
// HTTP body to carry a code through) — or, the recovery path a lost device
// needs, an admin turning it off for a DIFFERENT staff account with no code
// required (they're already an authenticated admin; requiring the
// locked-out user's code would defeat the point of a recovery path). Both
// branches are audit-logged; the cross-account branch doubly so, being the
// more sensitive of the two.
export async function POST(req: NextRequest) {
  const payload = await getPayload()
  if (!(await durableRateLimit(payload, `2fa-disable:${clientIp(req)}`, 10, 10 * 60_000))) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 })
  }

  const staff = await requireStaffUser(payload, req)
  if (!staff) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  // Accept either a string or number id — the admin panel's fetch call
  // (TwoFactorField.tsx) sends the doc's `id` as-is, which Payload IDs are
  // numeric for on this collection, so JSON round-trips it as a JS number.
  const rawTargetUserId = body?.targetUserId
  const targetUserId =
    typeof rawTargetUserId === 'string' || typeof rawTargetUserId === 'number' ? String(rawTargetUserId).trim() : ''

  if (targetUserId && String(targetUserId) !== String(staff.user.id)) {
    if (!isAdmin(staff.user)) {
      return NextResponse.json({ error: 'Only an admin can disable 2FA for another account.' }, { status: 403 })
    }
    const target = await payload.findByID({ collection: 'users', id: targetUserId, overrideAccess: true }).catch(() => null)
    if (!target) return NextResponse.json({ error: 'Account not found.' }, { status: 404 })

    await payload.update({
      collection: 'users',
      id: targetUserId,
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorPendingSecret: null, twoFactorEnabledAt: null },
      overrideAccess: true,
    })
    await logAuditEvent(payload, {
      collectionSlug: 'users',
      documentId: String(targetUserId),
      action: 'update',
      req: { user: staff.user },
      summary: `${staff.email} disabled two-factor authentication for ${target.email} (recovery)`,
    })
    return NextResponse.json({ ok: true })
  }

  // Self-disable — requires a current TOTP code.
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  const fresh = await payload.findByID({
    collection: 'users',
    id: staff.user.id,
    overrideAccess: true,
    // twoFactorSecret is `hidden: true` — see the same note in verify-setup/route.ts.
    showHiddenFields: true,
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  })
  if (!fresh?.twoFactorEnabled) {
    return NextResponse.json({ error: 'Two-factor authentication is not enabled.' }, { status: 400 })
  }
  if (!fresh.twoFactorSecret || !verifyTotpCode(fresh.twoFactorSecret, code)) {
    return NextResponse.json({ error: 'That code is incorrect or expired.' }, { status: 401 })
  }

  await payload.update({
    collection: 'users',
    id: staff.user.id,
    data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorPendingSecret: null, twoFactorEnabledAt: null },
    overrideAccess: true,
  })
  await logAuditEvent(payload, {
    collectionSlug: 'users',
    documentId: String(staff.user.id),
    action: 'update',
    req: { user: staff.user },
    summary: `${staff.email} disabled two-factor authentication`,
  })

  return NextResponse.json({ ok: true })
}
