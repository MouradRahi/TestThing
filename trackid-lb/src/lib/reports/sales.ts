import type { PgPool } from '../db-pool'
import type { ReportParams, ReportResult } from './types'
import { resolveDateRange, money } from './params'

const GROUP_BY: Record<string, string> = { day: 'day', week: 'week', month: 'month' }
const DIMENSIONS = ['product', 'artist', 'category', 'area', 'payment_method'] as const
type Dimension = (typeof DIMENSIONS)[number]

type Row = { [k: string]: unknown }

// Revenue/orders/AOV, sliceable either by time bucket (day/week/month) or by
// a single dimension (product/artist/category/area/payment method) across
// the whole range. Cancelled orders are excluded everywhere (they never
// represent real revenue) — matches the existing SalesDashboard convention.
export async function buildSalesReport(pool: PgPool, params: ReportParams): Promise<ReportResult> {
  const { from, to } = resolveDateRange(params)
  const locale = params.locale || 'en'
  const dimension = DIMENSIONS.includes(params.dimension as Dimension) ? (params.dimension as Dimension) : null

  const totals = await pool.query(
    `select count(*)::int as orders, coalesce(sum(total),0)::numeric as revenue
     from orders
     where order_status <> 'cancelled' and created_at >= $1 and created_at <= $2`,
    [from.toISOString(), to.toISOString()],
  )
  const totalOrders = Number((totals.rows[0] as Row).orders) || 0
  const totalRevenue = Number((totals.rows[0] as Row).revenue) || 0
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0

  const summary = [
    { label: 'Revenue', value: money(totalRevenue) },
    { label: 'Orders', value: String(totalOrders) },
    { label: 'Avg order value', value: money(aov) },
  ]

  if (!dimension) {
    const groupBy = GROUP_BY[params.groupBy ?? 'day'] ?? 'day'
    const { rows } = await pool.query(
      `select to_char(date_trunc($1, created_at), 'YYYY-MM-DD') as period,
              count(*)::int as orders,
              sum(total)::numeric as revenue
       from orders
       where order_status <> 'cancelled' and created_at >= $2 and created_at <= $3
       group by date_trunc($1, created_at)
       order by date_trunc($1, created_at)`,
      [groupBy, from.toISOString(), to.toISOString()],
    )
    return {
      title: 'Sales — by period',
      subtitle: `Grouped by ${groupBy}`,
      generatedAt: new Date().toISOString(),
      columns: [
        { key: 'period', label: 'Period' },
        { key: 'orders', label: 'Orders', align: 'right' },
        { key: 'revenue', label: 'Revenue', align: 'right' },
        { key: 'aov', label: 'Avg order value', align: 'right' },
      ],
      rows: rows.map((r) => {
        const rr = r as Row
        const orders = Number(rr.orders) || 0
        const revenue = Number(rr.revenue) || 0
        return {
          period: String(rr.period),
          orders,
          revenue: money(revenue),
          aov: money(orders > 0 ? revenue / orders : 0),
        }
      }),
      summary,
    }
  }

  const sql = dimensionQuery(dimension)
  const { rows } = await pool.query(sql, [from.toISOString(), to.toISOString(), locale])

  return {
    title: `Sales — by ${dimension.replace('_', ' ')}`,
    generatedAt: new Date().toISOString(),
    columns: [
      { key: 'label', label: dimensionLabel(dimension) },
      { key: 'qty', label: 'Qty', align: 'right' },
      { key: 'orders', label: 'Orders', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right' },
    ],
    rows: rows.map((r) => {
      const rr = r as Row
      return {
        label: rr.label == null ? 'Unknown' : String(rr.label),
        qty: rr.qty == null ? null : Number(rr.qty),
        orders: rr.orders == null ? null : Number(rr.orders),
        revenue: money(Number(rr.revenue) || 0),
      }
    }),
    summary,
  }
}

function dimensionLabel(d: Dimension): string {
  switch (d) {
    case 'product': return 'Product'
    case 'artist': return 'Artist'
    case 'category': return 'Category'
    case 'area': return 'Area'
    case 'payment_method': return 'Payment method'
  }
}

// $1 = from, $2 = to, $3 = locale (only used by artist/category, which read a
// localized name from a *_locales table — product titles are already
// snapshotted at purchase time in orders_items, so they need no locale join).
function dimensionQuery(d: Dimension): string {
  switch (d) {
    case 'product':
      return `
        select oi.title_at_purchase as label,
               sum(oi.quantity)::int as qty,
               count(distinct oi._parent_id)::int as orders,
               sum(oi.price_at_purchase * oi.quantity)::numeric as revenue
        from orders_items oi
        join orders o on o.id = oi._parent_id
        where o.order_status <> 'cancelled' and o.created_at >= $1 and o.created_at <= $2
        group by oi.title_at_purchase
        order by revenue desc
        limit 50`
    case 'artist':
      // Artists.name is a plain column (only bio/genre are localized on
      // Artists — unlike Categories, where `name` itself is localized), so
      // this is a direct join with no _locales table involved.
      return `
        select coalesce(ar.name, 'Unknown') as label,
               sum(oi.quantity)::int as qty,
               count(distinct oi._parent_id)::int as orders,
               sum(oi.price_at_purchase * oi.quantity)::numeric as revenue
        from orders_items oi
        join orders o on o.id = oi._parent_id
        left join products p on p.id = (oi.product_id)::integer
        left join artists ar on ar.id = p.artist_id
        where o.order_status <> 'cancelled' and o.created_at >= $1 and o.created_at <= $2
        group by ar.name
        order by revenue desc
        limit 50`
    case 'category':
      return `
        select coalesce(cl.name, 'Unknown') as label,
               sum(oi.quantity)::int as qty,
               count(distinct oi._parent_id)::int as orders,
               sum(oi.price_at_purchase * oi.quantity)::numeric as revenue
        from orders_items oi
        join orders o on o.id = oi._parent_id
        left join products p on p.id = (oi.product_id)::integer
        left join categories c on c.id = p.category_id
        left join categories_locales cl on cl._parent_id = c.id and cl._locale = $3
        where o.order_status <> 'cancelled' and o.created_at >= $1 and o.created_at <= $2
        group by cl.name
        order by revenue desc
        limit 50`
    case 'area':
      return `
        select o.area as label,
               null::int as qty,
               count(*)::int as orders,
               sum(o.total)::numeric as revenue
        from orders o
        where o.order_status <> 'cancelled' and o.created_at >= $1 and o.created_at <= $2
        group by o.area
        order by revenue desc
        limit 50`
    case 'payment_method':
      return `
        select o.payment_method as label,
               null::int as qty,
               count(*)::int as orders,
               sum(o.total)::numeric as revenue
        from orders o
        where o.order_status <> 'cancelled' and o.created_at >= $1 and o.created_at <= $2
        group by o.payment_method
        order by revenue desc`
  }
}
