import { getPayload } from '@/lib/payload'
import { requireAdminUser } from '@/lib/payments/admin-guard'
import { NextRequest, NextResponse } from 'next/server'

type TimelineEntry = { at: string; label: string; detail?: string }

// Order-timeline UI (ROADMAP F2 §2.6 leftover) — merges the two existing
// "de facto audit trails" this app already writes into one chronological
// view for staff, rather than making them cross-reference the Payments and
// Audit Log collections by hand: each Payment attempt's own status/rawEvents
// (initiated/pending/paid/failed/refunded, with provider refs) and every
// AuditLog row scoped to this order (status/paymentStatus transitions an
// admin made). No new writes, no new schema — purely a read-side merge of
// data both already record.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload()
  const admin = await requireAdminUser(payload, req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const entries: TimelineEntry[] = []

  const payments = await payload.find({
    collection: 'payments',
    where: { order: { equals: id } },
    sort: 'createdAt',
    limit: 50,
    overrideAccess: true,
  })
  for (const p of payments.docs) {
    entries.push({
      at: String(p.createdAt),
      label: `Payment ${p.provider} attempt created — ${p.status}`,
      detail: `${p.amount} ${p.currency} · ref ${p.providerRef}`,
    })
    if (p.updatedAt && p.updatedAt !== p.createdAt) {
      entries.push({
        at: String(p.updatedAt),
        label: `Payment ${p.provider} — now ${p.status}`,
        detail: `ref ${p.providerRef}`,
      })
    }
    const rawEvents = Array.isArray(p.rawEvents) ? p.rawEvents : []
    for (const ev of rawEvents) {
      if (ev && typeof ev === 'object') {
        const e = ev as Record<string, unknown>
        const at = typeof e.at === 'string' ? e.at : typeof e.receivedAt === 'string' ? e.receivedAt : undefined
        if (at) {
          entries.push({
            at,
            label: `Webhook event — ${p.provider}`,
            detail: typeof e.type === 'string' ? e.type : typeof e.status === 'string' ? String(e.status) : undefined,
          })
        }
      }
    }
  }

  const auditRows = await payload.find({
    collection: 'audit-log',
    where: { and: [{ collectionSlug: { equals: 'orders' } }, { documentId: { equals: String(id) } }] },
    sort: 'createdAt',
    limit: 100,
    overrideAccess: true,
  })
  for (const row of auditRows.docs) {
    entries.push({ at: String(row.createdAt), label: row.summary, detail: `by ${row.userEmail}` })
  }

  entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  return NextResponse.json({ entries })
}
