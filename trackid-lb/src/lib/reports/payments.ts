import type { PgPool } from '../db-pool'
import type { ReportParams, ReportResult } from './types'
import { resolveDateRange, money } from './params'

type Row = { [k: string]: unknown }

const METHOD_LABELS: Record<string, string> = {
  cod: 'Cash on Delivery',
  bank_transfer: 'Bank Transfer',
  card: 'Card',
  omt: 'OMT',
}

// Per-payment-method totals + refunds, reconciliation-ready (ROADMAP F2
// §2.7's PaymentsOpsPanel does the live "does Orders match Payments" check;
// this is the reportable, date-scoped rollup of the same money). Grouped by
// orders.payment_method (what the business actually sold through), not the
// Payments collection's `provider` field (mock/omt adapter internals) — COD
// and bank-transfer orders have no Payment record at all and must still
// appear here.
export async function buildPaymentsReport(pool: PgPool, params: ReportParams): Promise<ReportResult> {
  const { from, to } = resolveDateRange(params)

  const { rows } = await pool.query(
    `select payment_method,
            count(*)::int as orders,
            sum(total)::numeric as gross,
            sum(coalesce(refunded_amount, 0))::numeric as refunded
     from orders
     where payment_status in ('paid', 'partially_refunded', 'refunded')
       and created_at >= $1 and created_at <= $2
     group by payment_method
     order by gross desc`,
    [from.toISOString(), to.toISOString()],
  )

  let totalGross = 0
  let totalRefunded = 0
  const mapped = (rows as Row[]).map((r) => {
    const gross = Number(r.gross) || 0
    const refunded = Number(r.refunded) || 0
    totalGross += gross
    totalRefunded += refunded
    const method = String(r.payment_method)
    return {
      method: METHOD_LABELS[method] ?? method,
      orders: Number(r.orders) || 0,
      gross: money(gross),
      refunded: money(refunded),
      net: money(gross - refunded),
    }
  })

  return {
    title: 'Payments',
    subtitle: 'Paid orders only (incl. partially/fully refunded)',
    generatedAt: new Date().toISOString(),
    columns: [
      { key: 'method', label: 'Method' },
      { key: 'orders', label: 'Orders', align: 'right' },
      { key: 'gross', label: 'Gross', align: 'right' },
      { key: 'refunded', label: 'Refunded', align: 'right' },
      { key: 'net', label: 'Net', align: 'right' },
    ],
    rows: mapped,
    summary: [
      { label: 'Gross', value: money(totalGross) },
      { label: 'Refunded', value: money(totalRefunded) },
      { label: 'Net', value: money(totalGross - totalRefunded) },
    ],
  }
}
