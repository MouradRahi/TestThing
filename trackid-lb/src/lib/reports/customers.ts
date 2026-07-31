import type { PgPool } from '../db-pool'
import type { ReportParams, ReportResult } from './types'
import { resolveDateRange, money } from './params'

type Row = { [k: string]: unknown }

// "Customer" identity = the account (customer_id) when logged in, else the
// email address for guest checkouts — orders with neither (a guest who left
// email blank) can't be attributed to anyone and are excluded, same
// limitation noted for the "new vs returning" concept anywhere accounts are
// optional. New vs. returning is decided by comparing each identity's
// all-time first order against the selected range's start.
export async function buildCustomersReport(pool: PgPool, params: ReportParams): Promise<ReportResult> {
  const { from, to } = resolveDateRange(params)

  const [{ rows: allTimeRows }, { rows: rangeRows }, { rows: unattributed }] = await Promise.all([
    pool.query(
      `select coalesce(customer_id::text, lower(customer_email)) as identity,
              min(created_at) as first_order_at,
              count(*)::int as orders_all_time
       from orders
       where order_status <> 'cancelled' and (customer_id is not null or customer_email is not null)
       group by identity`,
    ),
    pool.query(
      `select coalesce(customer_id::text, lower(customer_email)) as identity,
              max(customer_name) as name,
              count(*)::int as orders_in_range,
              sum(total)::numeric as spent_in_range
       from orders
       where order_status <> 'cancelled' and (customer_id is not null or customer_email is not null)
         and created_at >= $1 and created_at <= $2
       group by identity
       order by spent_in_range desc
       limit 200`,
      [from.toISOString(), to.toISOString()],
    ),
    pool.query(
      `select count(*)::int as n
       from orders
       where order_status <> 'cancelled' and customer_id is null and customer_email is null
         and created_at >= $1 and created_at <= $2`,
      [from.toISOString(), to.toISOString()],
    ),
  ])

  const allTimeByIdentity = new Map<string, { firstOrderAt: string; ordersAllTime: number }>()
  for (const r of allTimeRows as Row[]) {
    allTimeByIdentity.set(String(r.identity), {
      firstOrderAt: String(r.first_order_at),
      ordersAllTime: Number(r.orders_all_time) || 0,
    })
  }

  let newCount = 0
  let returningCount = 0
  const rows = (rangeRows as Row[]).map((r) => {
    const identity = String(r.identity)
    const at = allTimeByIdentity.get(identity)
    const isNew = at ? new Date(at.firstOrderAt).getTime() >= from.getTime() : true
    if (isNew) newCount += 1
    else returningCount += 1
    return {
      name: r.name == null ? '—' : String(r.name),
      ordersInRange: Number(r.orders_in_range) || 0,
      spentInRange: money(Number(r.spent_in_range) || 0),
      status: isNew ? 'New' : 'Returning',
      ordersAllTime: at?.ordersAllTime ?? (Number(r.orders_in_range) || 0),
    }
  })

  const identitiesSeen = allTimeRows.length
  const totalAllTimeOrders = (allTimeRows as Row[]).reduce((s, r) => s + (Number(r.orders_all_time) || 0), 0)
  const avgOrderFrequency = identitiesSeen > 0 ? totalAllTimeOrders / identitiesSeen : 0
  const repeatRate = rows.length > 0 ? returningCount / rows.length : 0

  return {
    title: 'Customers',
    subtitle: `${identitiesSeen} known customer identities all-time (accounts + emailed guest checkouts)`,
    generatedAt: new Date().toISOString(),
    columns: [
      { key: 'name', label: 'Customer' },
      { key: 'status', label: 'Status' },
      { key: 'ordersInRange', label: 'Orders (range)', align: 'right' },
      { key: 'spentInRange', label: 'Spent (range)', align: 'right' },
      { key: 'ordersAllTime', label: 'Orders (all-time)', align: 'right' },
    ],
    rows,
    summary: [
      { label: 'New customers', value: String(newCount) },
      { label: 'Returning customers', value: String(returningCount) },
      { label: 'Repeat rate', value: `${Math.round(repeatRate * 100)}%` },
      { label: 'Avg orders/customer (all-time)', value: avgOrderFrequency.toFixed(1) },
      { label: 'Unattributed orders (range)', value: String(Number((unattributed[0] as Row)?.n) || 0) },
    ],
  }
}
