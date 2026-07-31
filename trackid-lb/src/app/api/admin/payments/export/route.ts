import { getPayload } from '@/lib/payload'
import { requireAdminUser } from '@/lib/payments/admin-guard'
import { NextRequest, NextResponse } from 'next/server'

// Payments/orders export for the accountant (ROADMAP F2 §2.7) — feeds into
// the future Part 4 report engine; for now a straight CSV dump of every
// order's money fields. Cookie-authenticated (a plain <a href> download link
// from the admin dashboard, not a fetch call) so this checks the session the
// same way the admin UI itself does.
function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const COLUMNS = [
  'orderNumber',
  'createdAt',
  'paymentMethod',
  'paymentStatus',
  'orderStatus',
  'subtotal',
  'deliveryFee',
  'discountAmount',
  'total',
  'refundedAmount',
] as const

export async function GET(req: NextRequest) {
  const payload = await getPayload()
  const admin = await requireAdminUser(payload, req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { docs: orders } = await payload.find({
    collection: 'orders',
    limit: 5000,
    depth: 0,
    sort: '-createdAt',
  })

  const rows = [
    COLUMNS.join(','),
    ...orders.map((o) => COLUMNS.map((col) => csvEscape((o as unknown as Record<string, unknown>)[col])).join(',')),
  ]

  return new NextResponse(rows.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
