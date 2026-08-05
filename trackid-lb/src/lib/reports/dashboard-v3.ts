import type { PgPool } from '../db-pool'

type Row = { [k: string]: unknown }

export type FunnelStage = { label: string; count: number; pctOfPrevious: number | null }

// Sessions → Carts → Checkouts → Completed (ROADMAP Part 4 §4.3). "Sessions"
// comes from the own page-view counter (src/lib/analytics.ts); "Carts" is
// distinct carts that had at least one item added in range; "Checkouts" is
// every order created in range regardless of outcome (an Order row only
// exists once the checkout form was actually submitted — we have no
// intermediate "started checkout" signal without more instrumentation);
// "Completed" is orders that weren't cancelled. Deliberately not further
// split by payment outcome here — that's what buildPaymentMix covers.
export async function buildFunnel(pool: PgPool, from: Date, to: Date): Promise<FunnelStage[]> {
  const fromIso = from.toISOString()
  const toIso = to.toISOString()
  const fromDate = fromIso.slice(0, 10)
  const toDate = toIso.slice(0, 10)

  const [sessionsRes, cartsRes, checkoutsRes, completedRes] = await Promise.all([
    pool.query(
      `select coalesce(sum(page_views), 0)::int as n from analytics_counters where date >= $1 and date <= $2`,
      [fromDate, toDate],
    ),
    pool.query(
      `select count(distinct c.id)::int as n
       from carts c
       join carts_items ci on ci._parent_id = c.id
       where c.created_at >= $1 and c.created_at <= $2`,
      [fromIso, toIso],
    ),
    pool.query(`select count(*)::int as n from orders where created_at >= $1 and created_at <= $2`, [fromIso, toIso]),
    pool.query(
      `select count(*)::int as n from orders where created_at >= $1 and created_at <= $2 and order_status <> 'cancelled'`,
      [fromIso, toIso],
    ),
  ])

  const counts = [
    Number((sessionsRes.rows[0] as Row).n) || 0,
    Number((cartsRes.rows[0] as Row).n) || 0,
    Number((checkoutsRes.rows[0] as Row).n) || 0,
    Number((completedRes.rows[0] as Row).n) || 0,
  ]
  const labels = ['Sessions', 'Carts', 'Checkouts', 'Completed orders']

  return labels.map((label, i) => ({
    label,
    count: counts[i],
    pctOfPrevious: i === 0 || counts[i - 1] === 0 ? null : (counts[i] / counts[i - 1]) * 100,
  }))
}

export type CohortRow = {
  cohortMonth: string
  customers: number
  repeatCustomers: number
  repeatRate: number
  avgOrders: number
}

// Cohort/repeat-purchase view (ROADMAP §4.3) — customers grouped by the
// calendar month of their first (non-cancelled) order, then how many of
// each cohort ever placed a second order (all-time, not range-scoped — a
// cohort's repeat behavior only becomes meaningful over time). Identity =
// account id, else lower-cased guest email, same convention as the
// Customers report in sales.ts's sibling customers.ts.
export async function buildCohorts(pool: PgPool): Promise<CohortRow[]> {
  const { rows } = await pool.query(`
    with identity_orders as (
      select coalesce(customer_id::text, lower(customer_email)) as identity, created_at
      from orders
      where order_status <> 'cancelled' and (customer_id is not null or customer_email is not null)
    ),
    first_orders as (
      select identity, min(created_at) as first_at, count(*)::int as total_orders
      from identity_orders
      group by identity
    )
    select to_char(date_trunc('month', first_at), 'YYYY-MM') as cohort_month,
           count(*)::int as customers,
           count(*) filter (where total_orders > 1)::int as repeat_customers,
           avg(total_orders)::numeric as avg_orders
    from first_orders
    group by date_trunc('month', first_at)
    order by 1
  `)

  return (rows as Row[]).map((r) => {
    const customers = Number(r.customers) || 0
    const repeatCustomers = Number(r.repeat_customers) || 0
    return {
      cohortMonth: String(r.cohort_month),
      customers,
      repeatCustomers,
      repeatRate: customers > 0 ? repeatCustomers / customers : 0,
      avgOrders: Number(r.avg_orders) || 0,
    }
  })
}

export type PaymentMixRow = {
  method: string
  attempted: number
  succeeded: number
  failed: number
  failureRate: number | null
}

const METHOD_LABELS: Record<string, string> = {
  cod: 'Cash on Delivery',
  bank_transfer: 'Bank Transfer',
  card: 'Card',
  omt: 'OMT',
}

// Payment-method mix + failure rate (ROADMAP §4.3). Failure rate is only
// meaningful for online methods (card/omt) that have a distinct
// failed/expired outcome — COD/bank-transfer orders have no such concept, so
// they're included in the mix but always report a null failure rate.
// "Attempted" excludes still-in-flight `awaiting_payment` orders (their
// outcome isn't decided yet) so the rate reflects concluded attempts only.
export async function buildPaymentMix(pool: PgPool, from: Date, to: Date): Promise<PaymentMixRow[]> {
  const { rows } = await pool.query(
    `select payment_method,
            count(*) filter (where payment_status not in ('awaiting_payment', 'pending'))::int as attempted,
            count(*) filter (where payment_status in ('paid', 'partially_refunded', 'refunded'))::int as succeeded,
            count(*) filter (where payment_status in ('failed', 'expired'))::int as failed
     from orders
     where created_at >= $1 and created_at <= $2
     group by payment_method
     order by attempted desc`,
    [from.toISOString(), to.toISOString()],
  )

  return (rows as Row[]).map((r) => {
    const method = String(r.payment_method)
    const attempted = Number(r.attempted) || 0
    const failed = Number(r.failed) || 0
    const isOnline = method === 'card' || method === 'omt'
    return {
      method: METHOD_LABELS[method] ?? method,
      attempted,
      succeeded: Number(r.succeeded) || 0,
      failed,
      failureRate: isOnline && attempted > 0 ? failed / attempted : null,
    }
  })
}
