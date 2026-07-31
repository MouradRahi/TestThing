import { getPayload } from '@/lib/payload'
import { requireAdminUser } from '@/lib/payments/admin-guard'
import { processRefund } from '@/lib/payments/service'
import { logAuditEvent } from '@/lib/audit-log'
import { durableRateLimit } from '@/lib/durable-rate-limit'
import { clientIp } from '@/lib/api-guards'
import { NextRequest, NextResponse } from 'next/server'

// Admin refund action (ROADMAP F2 §2.6) — works for every payment method.
// processRefund() handles the provider-record side (card/OMT); this route is
// just auth + validation + the audit trail.
export async function POST(req: NextRequest) {
  const payload = await getPayload()
  const admin = await requireAdminUser(payload, req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  if (!(await durableRateLimit(payload, `admin-refund:${clientIp(req)}`, 30, 10 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const orderId = body?.orderId
  const amount = Number(body?.amount)
  const restock = Boolean(body?.restock)
  if (orderId == null || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Invalid orderId or amount' }, { status: 400 })
  }

  const result = await processRefund(payload, { orderId, amount, restock, adminEmail: admin.email })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  await logAuditEvent(payload, {
    collectionSlug: 'orders',
    documentId: String(orderId),
    action: 'update',
    req: { user: admin.user },
    summary: `Order ${orderId}: refunded $${amount.toFixed(2)} by ${admin.email}${restock ? ' (restocked)' : ''} — now ${result.paymentStatus}`,
  })

  return NextResponse.json({ ok: true, refundedAmount: result.refundedAmount, paymentStatus: result.paymentStatus })
}
