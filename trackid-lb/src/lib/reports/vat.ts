import type { PgPool } from '../db-pool'
import type { ReportParams, ReportResult } from './types'
import { resolveDateRange, money } from './params'
import { computeVatBreakdown } from '../vat'

const GROUP_BY: Record<string, string> = { day: 'day', week: 'week', month: 'month' }
type Row = { [k: string]: unknown }

// VAT collected on sales in range (ROADMAP Part 4 §4.1's VAT sub-item,
// unblocked by Part 3.1's VAT settings). Prices are VAT-inclusive (Part
// 3.1's invoice convention — see src/lib/vat.ts), so this *extracts* the VAT
// share already inside each order's `total` rather than adding VAT on top.
// Same non-cancelled-orders scope as buildSalesReport, for the same reason:
// VAT is due on a completed sale regardless of payment status (COD orders
// haven't been paid yet at creation but are still real, taxable sales).
//
// ⚠️ Uses the site's *current* SiteSettings.vatRate for every order in
// range — there's no per-order rate snapshot in the schema (unlike
// `exchangeRateAtPurchase` for currency), so a rate change mid-period will
// retroactively recompute past orders at the new rate here. Acceptable for
// a single-rate-most-of-the-time Lebanese SMB; flagged rather than silently
// assumed away, and a real limitation to fix (an `orders.vatRateAtPurchase`
// snapshot column) if the business ever changes its registered rate.
export async function buildVatReport(pool: PgPool, params: ReportParams): Promise<ReportResult> {
  const { from, to } = resolveDateRange(params)

  const settingsRes = await pool.query(
    `select vat_enabled, vat_rate, vat_registration_number from site_settings limit 1`,
  )
  const settingsRow = (settingsRes.rows[0] as Row) ?? {}
  const vatEnabled = Boolean(settingsRow.vat_enabled) && Number(settingsRow.vat_rate) > 0
  const vatRate = Number(settingsRow.vat_rate) || 0

  if (!vatEnabled) {
    return {
      title: 'VAT',
      subtitle: 'VAT is not enabled in Site Settings → Commerce — nothing to report.',
      generatedAt: new Date().toISOString(),
      columns: [{ key: 'period', label: 'Period' }],
      rows: [],
      summary: [{ label: 'Status', value: 'VAT disabled' }],
    }
  }

  const groupBy = GROUP_BY[params.groupBy ?? 'day'] ?? 'day'
  const { rows } = await pool.query(
    `select to_char(date_trunc($1, created_at), 'YYYY-MM-DD') as period,
            count(*)::int as orders,
            coalesce(sum(total), 0)::numeric as gross
     from orders
     where order_status <> 'cancelled' and created_at >= $2 and created_at <= $3
     group by date_trunc($1, created_at)
     order by date_trunc($1, created_at)`,
    [groupBy, from.toISOString(), to.toISOString()],
  )

  let totalGross = 0
  let totalVat = 0
  let totalNet = 0
  const mapped = (rows as Row[]).map((r) => {
    const orders = Number(r.orders) || 0
    const gross = Number(r.gross) || 0
    const { net, vat } = computeVatBreakdown(gross, vatRate)
    totalGross += gross
    totalVat += vat
    totalNet += net
    return {
      period: String(r.period),
      orders,
      net: money(net),
      vat: money(vat),
      gross: money(gross),
    }
  })

  const registrationNumber =
    typeof settingsRow.vat_registration_number === 'string' && settingsRow.vat_registration_number.trim()
      ? settingsRow.vat_registration_number.trim()
      : undefined

  return {
    title: 'VAT',
    subtitle: `${vatRate}% · ${registrationNumber ? `Reg. ${registrationNumber} · ` : ''}grouped by ${groupBy}`,
    generatedAt: new Date().toISOString(),
    columns: [
      { key: 'period', label: 'Period' },
      { key: 'orders', label: 'Orders', align: 'right' },
      { key: 'net', label: 'Net', align: 'right' },
      { key: 'vat', label: 'VAT', align: 'right' },
      { key: 'gross', label: 'Gross', align: 'right' },
    ],
    rows: mapped,
    summary: [
      { label: 'Net', value: money(totalNet) },
      { label: 'VAT collected', value: money(totalVat) },
      { label: 'Gross', value: money(totalGross) },
    ],
  }
}
