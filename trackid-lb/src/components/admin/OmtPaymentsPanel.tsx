import React from 'react'
import { getPayload } from '@/lib/payload'
import { isAdmin } from '@/lib/access'
import { MarkOmtPaidButton } from './MarkOmtPaidButton'

// OMT v1's manual-confirm queue (ROADMAP F2 §2.4) — every order awaiting a
// pay-at-branch voucher confirmation, oldest first (most time-pressed).
// Renders nothing when empty so it doesn't clutter the dashboard for stores
// that haven't turned OMT on. Admin-only, server-rendered like SalesDashboard.
const money = (n: number) => `$${n.toFixed(2)}`

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
  marginBottom: '0.75rem',
}

type OrderLite = {
  id: number | string
  orderNumber?: string
  customerName?: string
  total?: number | null
  createdAt?: string
}

export async function OmtPaymentsPanel(props: { user?: unknown }) {
  if (!isAdmin(props.user)) return null

  const payload = await getPayload()
  const { docs: orders } = await payload.find({
    collection: 'orders',
    where: { paymentMethod: { equals: 'omt' }, paymentStatus: { equals: 'awaiting_payment' } },
    sort: 'createdAt',
    limit: 100,
    depth: 0,
  })

  if (orders.length === 0) return null

  const orderIds = orders.map((o) => o.id)
  const { docs: payments } = await payload.find({
    collection: 'payments',
    where: { order: { in: orderIds } },
    limit: 200,
    depth: 0,
  })
  const voucherByOrder = new Map(payments.map((p) => [String(p.order), p.providerRef as string]))

  return (
    <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
      <div style={labelStyle}>OMT Payments Awaiting Confirmation · {orders.length}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--theme-elevation-500)', fontSize: '0.75rem' }}>
              <th style={{ padding: '0 0.5rem 0.4rem 0', fontWeight: 500 }}>Order</th>
              <th style={{ padding: '0 0.5rem 0.4rem', fontWeight: 500 }}>Customer</th>
              <th style={{ padding: '0 0.5rem 0.4rem', fontWeight: 500 }}>Voucher code</th>
              <th style={{ padding: '0 0.5rem 0.4rem', fontWeight: 500 }}>Total</th>
              <th style={{ padding: '0 0.5rem 0.4rem', fontWeight: 500 }}>Placed</th>
              <th style={{ padding: '0 0 0.4rem 0.5rem', fontWeight: 500 }} />
            </tr>
          </thead>
          <tbody>
            {(orders as OrderLite[]).map((o) => (
              <tr key={o.id} style={{ borderTop: '1px solid var(--theme-elevation-100)' }}>
                <td style={{ padding: '0.5rem 0.5rem 0.5rem 0', fontFamily: 'var(--font-mono)' }}>{o.orderNumber}</td>
                <td style={{ padding: '0.5rem' }}>{o.customerName}</td>
                <td style={{ padding: '0.5rem', fontFamily: 'var(--font-mono)' }}>{voucherByOrder.get(String(o.id)) ?? '—'}</td>
                <td style={{ padding: '0.5rem' }}>{money(o.total ?? 0)}</td>
                <td style={{ padding: '0.5rem', color: 'var(--theme-elevation-500)' }}>
                  {o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}
                </td>
                <td style={{ padding: '0.5rem 0 0.5rem 0.5rem' }}>
                  <MarkOmtPaidButton orderId={o.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
