import React from 'react'
import { getPayload } from '@/lib/payload'
import { isAdmin } from '@/lib/access'
import { RefundButton } from './RefundButton'

// Reconciliation + refunds (ROADMAP F2 §2.6/§2.7) — per-provider totals for
// paid orders, a mismatch check between Orders and Payments (should always
// be empty; a non-empty list means the two records disagree and needs a
// human look), a CSV export link, and a refund action on recent paid orders.
// JS aggregation over `payload.find` is fine at this store's scale (same
// call this codebase already makes in SalesDashboard); switch to SQL via
// payload.db.pool if order volume grows large (Part 4).
const money = (n: number) => `$${n.toFixed(2)}`

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: 'Cash on Delivery',
  bank_transfer: 'Bank Transfer',
  card: 'Card',
  omt: 'OMT',
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 'var(--style-radius-m, 4px)',
  background: 'var(--theme-elevation-50)',
  padding: '1rem 1.25rem',
}
const labelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--theme-elevation-500)',
  marginBottom: '0.35rem',
}

type OrderLite = {
  id: number | string
  orderNumber?: string
  paymentMethod?: string
  paymentStatus?: string
  total?: number | null
  refundedAmount?: number | null
  createdAt?: string
}
type PaymentLite = { order?: unknown; status?: string }

export async function PaymentsOpsPanel(props: { user?: unknown }) {
  if (!isAdmin(props.user)) return null

  const payload = await getPayload()
  const [{ docs: ordersRaw }, { docs: paymentsRaw }] = await Promise.all([
    payload.find({ collection: 'orders', limit: 5000, depth: 0, sort: '-createdAt' }),
    payload.find({ collection: 'payments', limit: 5000, depth: 0 }),
  ])
  const orders = ordersRaw as OrderLite[]
  const payments = paymentsRaw as PaymentLite[]

  // Per-provider totals (paid orders only — refunds still count as "was paid").
  const totalsByMethod = new Map<string, { count: number; total: number }>()
  for (const o of orders) {
    if (o.paymentStatus !== 'paid' && o.paymentStatus !== 'partially_refunded' && o.paymentStatus !== 'refunded') continue
    const key = o.paymentMethod ?? 'unknown'
    const entry = totalsByMethod.get(key) ?? { count: 0, total: 0 }
    entry.count += 1
    entry.total += o.total ?? 0
    totalsByMethod.set(key, entry)
  }

  // Mismatch check between Orders and Payments — should always be empty,
  // since applyPaymentEvent()/processRefund() update both atomically. A
  // non-empty list means something bypassed that path.
  const paymentByOrder = new Map(payments.map((p) => [String(p.order), p]))
  const mismatches: string[] = []
  for (const o of orders) {
    if (o.paymentMethod !== 'card' && o.paymentMethod !== 'omt') continue
    const p = paymentByOrder.get(String(o.id))
    if (o.paymentStatus === 'paid' && p?.status !== 'paid') {
      mismatches.push(`Order ${o.orderNumber} is paid, but its payment record shows "${p?.status ?? 'missing'}".`)
    }
    if (p?.status === 'paid' && !['paid', 'partially_refunded', 'refunded'].includes(o.paymentStatus ?? '')) {
      mismatches.push(`Payment for order ${o.orderNumber} is paid, but the order shows "${o.paymentStatus}".`)
    }
  }

  const recentPaid = orders.filter((o) => o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded').slice(0, 15)

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Payments Reconciliation</h2>
        <a href="/api/admin/payments/export" style={{ fontSize: '0.8rem' }}>
          Export CSV →
        </a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {totalsByMethod.size === 0 ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--theme-elevation-500)' }}>No paid orders yet.</div>
        ) : (
          [...totalsByMethod.entries()].map(([method, v]) => (
            <div key={method} style={cardStyle}>
              <div style={labelStyle}>{PAYMENT_METHOD_LABELS[method] ?? method}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{money(v.total)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-500)' }}>{v.count} orders</div>
            </div>
          ))
        )}
      </div>

      {mismatches.length > 0 && (
        <div style={{ ...cardStyle, borderColor: 'var(--theme-error-500, #ef4444)', marginBottom: '1rem' }}>
          <div style={{ ...labelStyle, color: 'var(--theme-error-600, #dc2626)', marginBottom: '0.5rem' }}>
            ⚠ {mismatches.length} mismatch{mismatches.length === 1 ? '' : 'es'}
          </div>
          {mismatches.map((m, i) => (
            <div key={i} style={{ fontSize: '0.8rem', padding: '0.2rem 0' }}>
              {m}
            </div>
          ))}
        </div>
      )}

      <div style={cardStyle}>
        <div style={labelStyle}>Recent paid orders</div>
        {recentPaid.length === 0 ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--theme-elevation-500)' }}>No paid orders yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <tbody>
                {recentPaid.map((o) => (
                  <tr key={o.id} style={{ borderTop: '1px solid var(--theme-elevation-100)' }}>
                    <td style={{ padding: '0.5rem 0.5rem 0.5rem 0', fontFamily: 'var(--font-mono)' }}>{o.orderNumber}</td>
                    <td style={{ padding: '0.5rem' }}>{PAYMENT_METHOD_LABELS[o.paymentMethod ?? ''] ?? o.paymentMethod}</td>
                    <td style={{ padding: '0.5rem' }}>{money(o.total ?? 0)}</td>
                    <td style={{ padding: '0.5rem', color: 'var(--theme-elevation-500)' }}>
                      {(o.refundedAmount ?? 0) > 0 ? `Refunded ${money(o.refundedAmount ?? 0)}` : ''}
                    </td>
                    <td style={{ padding: '0.5rem 0 0.5rem 0.5rem' }}>
                      <RefundButton orderId={o.id} total={o.total ?? 0} refundedAmount={o.refundedAmount ?? 0} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
