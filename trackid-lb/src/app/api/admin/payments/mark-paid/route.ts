import { getPayload } from '@/lib/payload'
import { requireAdminUser } from '@/lib/payments/admin-guard'
import { markPaymentPaidManually } from '@/lib/payments/service'
import { logAuditEvent } from '@/lib/audit-log'
import { durableRateLimit } from '@/lib/durable-rate-limit'
import { clientIp } from '@/lib/api-guards'
import { NextRequest, NextResponse } from 'next/server'

// OMT v1's manual-confirm fallback (ROADMAP F2 §2.4) — staff action from the
// "OMT Payments" admin dashboard panel. Routes through applyPaymentEvent()
// (via markPaymentPaidManually), the exact same code path a real webhook
// would use, so the Orders paid-transition hook (confirmation email/WhatsApp)
// fires identically regardless of how the order got paid.
export async function POST(req: NextRequest) {
  const payload = await getPayload()
  const admin = await requireAdminUser(payload, req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  if (!(await durableRateLimit(payload, `admin-mark-paid:${clientIp(req)}`, 30, 10 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const orderId = body?.orderId
  if (orderId == null) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })

  const result = await markPaymentPaidManually(payload, orderId, admin.email)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  if (!result.alreadyProcessed) {
    await logAuditEvent(payload, {
      collectionSlug: 'orders',
      documentId: String(orderId),
      action: 'update',
      req: { user: admin.user },
      summary: `Order ${orderId}: OMT payment manually confirmed by ${admin.email}`,
    })
  }

  return NextResponse.json({ ok: true, alreadyProcessed: result.alreadyProcessed })
}
