import type { PgPool } from '../db-pool'
import type { ReportParams, ReportResult } from './types'
import { resolveDateRange, money } from './params'

type Row = { [k: string]: unknown }

// Usage + revenue impact per code within the range, alongside the code's
// all-time usageCount/usageLimit (from the Discounts collection itself, the
// authoritative redemption counter — see src/lib/discounts.ts). Matched
// case-insensitively since orders.discount_code is stored as validated at
// checkout time and discounts.code is normalized uppercase on save.
export async function buildDiscountsReport(pool: PgPool, params: ReportParams): Promise<ReportResult> {
  const { from, to } = resolveDateRange(params)

  const { rows } = await pool.query(
    `select d.code, d.type, d.value, d.enabled, d.usage_limit, d.usage_count,
            coalesce(r.orders_in_range, 0)::int as orders_in_range,
            coalesce(r.discount_in_range, 0)::numeric as discount_in_range,
            coalesce(r.revenue_in_range, 0)::numeric as revenue_in_range
     from discounts d
     left join (
       select discount_code,
              count(*)::int as orders_in_range,
              sum(discount_amount)::numeric as discount_in_range,
              sum(total)::numeric as revenue_in_range
       from orders
       where order_status <> 'cancelled' and discount_code is not null
         and created_at >= $1 and created_at <= $2
       group by discount_code
     ) r on upper(r.discount_code) = d.code
     order by discount_in_range desc nulls last`,
    [from.toISOString(), to.toISOString()],
  )

  let totalDiscount = 0
  let totalOrders = 0
  const mapped = (rows as Row[]).map((r) => {
    const discountInRange = Number(r.discount_in_range) || 0
    const ordersInRange = Number(r.orders_in_range) || 0
    totalDiscount += discountInRange
    totalOrders += ordersInRange
    return {
      code: String(r.code),
      type: r.type === 'fixed' ? 'Fixed' : 'Percentage',
      value: r.type === 'fixed' ? money(Number(r.value)) : `${r.value}%`,
      enabled: r.enabled ? 'Yes' : 'No',
      ordersInRange,
      discountInRange: money(discountInRange),
      revenueInRange: money(Number(r.revenue_in_range) || 0),
      usageAllTime: `${r.usage_count ?? 0}${r.usage_limit ? ` / ${r.usage_limit}` : ''}`,
    }
  })

  return {
    title: 'Discount codes',
    generatedAt: new Date().toISOString(),
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'type', label: 'Type' },
      { key: 'value', label: 'Value' },
      { key: 'enabled', label: 'Enabled' },
      { key: 'ordersInRange', label: 'Orders (range)', align: 'right' },
      { key: 'discountInRange', label: 'Discount given (range)', align: 'right' },
      { key: 'revenueInRange', label: 'Order revenue (range)', align: 'right' },
      { key: 'usageAllTime', label: 'Usage (all-time)', align: 'right' },
    ],
    rows: mapped,
    summary: [
      { label: 'Discount given (range)', value: money(totalDiscount) },
      { label: 'Orders using a code (range)', value: String(totalOrders) },
      { label: 'Active codes', value: String(mapped.filter((m) => m.enabled === 'Yes').length) },
    ],
  }
}
