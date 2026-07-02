import React from 'react'
import Link from 'next/link'
import { getPayload } from '@/lib/payload'
import { totalStock } from '@/lib/stock'
import { isAdmin } from '@/lib/access'

// First-party sales analytics shown above the admin dashboard. Server-rendered,
// no extra dependencies. Aggregation is done in JS over the orders (fine for
// launch volumes; switch to SQL via payload.db.pool if order count grows large).
// Revenue excludes cancelled orders. Admin-only.

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

const PENDING_FULFILMENT = ['pending', 'confirmed', 'in_production']

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_production: 'In Production',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: 'all', label: 'All time' },
] as const

type RangeKey = (typeof RANGES)[number]['key']

const DAY = 86_400_000
function sinceFor(key: RangeKey): number {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  switch (key) {
    case 'today': return startOfToday.getTime()
    case '7d': return Date.now() - 7 * DAY
    case '30d': return Date.now() - 30 * DAY
    case '90d': return Date.now() - 90 * DAY
    case 'all': return 0
  }
}

// Length of the selected window, used to define the equal-length prior period for
// comparison. `all` has no prior period.
function rangeMsFor(key: RangeKey): number | null {
  switch (key) {
    case 'today': return DAY
    case '7d': return 7 * DAY
    case '30d': return 30 * DAY
    case '90d': return 90 * DAY
    case 'all': return null
  }
}

// Percentage change vs the prior period, as a small colored badge.
function pctDelta(cur: number, prev: number): { text: string; color: string } | null {
  if (prev <= 0) return cur > 0 ? { text: 'new', color: 'var(--theme-success-600, #16a34a)' } : null
  const pct = ((cur - prev) / prev) * 100
  if (Math.abs(pct) < 0.5) return { text: '±0%', color: 'var(--theme-elevation-500)' }
  const up = pct > 0
  return {
    text: `${up ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}%`,
    color: up ? 'var(--theme-success-600, #16a34a)' : 'var(--theme-error-600, #dc2626)',
  }
}

type OrderLite = {
  total?: number | null
  orderStatus?: string
  paymentMethod?: string
  area?: string
  createdAt?: string
  items?: Array<{ productId?: string; titleAtPurchase?: string; quantity?: number; priceAtPurchase?: number }>
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

function Kpi({
  label,
  value,
  sub,
  delta,
}: {
  label: string
  value: string
  sub?: string
  delta?: { text: string; color: string } | null
}) {
  return (
    <div style={cardStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
        {delta && <span style={{ fontSize: '0.8rem', fontWeight: 600, color: delta.color }}>{delta.text}</span>}
      </div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-500)', marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={cardStyle}>
      <div style={{ ...labelStyle, marginBottom: '0.75rem' }}>{title}</div>
      {children}
    </div>
  )
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.3rem 0', fontSize: '0.85rem' }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{left}</span>
      <span style={{ color: 'var(--theme-elevation-650)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{right}</span>
    </div>
  )
}

// Dependency-free daily revenue bar chart for the last 30 days.
function RevenueChart({ orders }: { orders: OrderLite[] }) {
  const DAYS = 30
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (DAYS - 1))

  const buckets: number[] = new Array(DAYS).fill(0)
  for (const o of orders) {
    if (!o.createdAt) continue
    const t = new Date(o.createdAt).getTime()
    const dayIndex = Math.floor((t - start.getTime()) / DAY)
    if (dayIndex >= 0 && dayIndex < DAYS) buckets[dayIndex] += o.total ?? 0
  }
  const max = Math.max(...buckets, 1)
  const fmtDay = (offset: number) => {
    const d = new Date(start)
    d.setDate(start.getDate() + offset)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
        <div style={labelStyle}>Daily revenue · last 30 days</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-500)' }}>peak {money(max)}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '110px' }}>
        {buckets.map((v, i) => (
          <div
            key={i}
            title={`${fmtDay(i)}: ${money(v)}`}
            style={{
              flex: 1,
              height: `${(v / max) * 100}%`,
              minHeight: v > 0 ? '2px' : '0',
              background: 'var(--theme-success-500, #4ade80)',
              borderRadius: '1px',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--theme-elevation-450)', marginTop: '0.4rem' }}>
        <span>{fmtDay(0)}</span>
        <span>{fmtDay(DAYS - 1)}</span>
      </div>
    </div>
  )
}

export async function SalesDashboard(props: {
  user?: unknown
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  // Revenue is sensitive — only show to admins
  if (!isAdmin(props.user)) return null

  const rangeParam = typeof props.searchParams?.range === 'string' ? props.searchParams.range : '30d'
  const selected = RANGES.find((r) => r.key === rangeParam) ?? RANGES.find((r) => r.key === '30d')!
  const since = sinceFor(selected.key)

  const payload = await getPayload()
  const [{ docs: orders }, { docs: products }, newRequests] = await Promise.all([
    payload.find({ collection: 'orders', limit: 5000, depth: 0, sort: '-createdAt' }),
    payload.find({ collection: 'products', where: { status: { equals: 'published' } }, limit: 1000, depth: 1 }),
    payload.count({ collection: 'custom-requests', where: { status: { equals: 'new' } } }),
  ])

  const all = orders as OrderLite[]
  const live = all.filter((o) => o.orderStatus !== 'cancelled')

  // productId → artist name (for the top-artists breakdown)
  const artistOf = new Map<string, string>()
  for (const p of products) {
    const a = (p as { artist?: unknown }).artist
    if (a && typeof a === 'object' && 'name' in a) artistOf.set(String((p as { id: unknown }).id), String((a as { name: unknown }).name))
  }

  // ── Range-scoped slices ───────────────────────────────────────────────────
  const inRange = (o: OrderLite) => !!o.createdAt && new Date(o.createdAt).getTime() >= since
  const rangeAll = all.filter(inRange)
  const rangeLive = live.filter(inRange)

  const revenue = rangeLive.reduce((s, o) => s + (o.total ?? 0), 0)
  const orderCount = rangeLive.length
  const aov = orderCount > 0 ? revenue / orderCount : 0
  const awaiting = all.filter((o) => PENDING_FULFILMENT.includes(o.orderStatus ?? '')).length

  // ── Prior equal-length period (for comparison deltas) ─────────────────────
  const rangeMs = rangeMsFor(selected.key)
  const prevSince = rangeMs == null ? null : since - rangeMs
  const prevLive =
    prevSince == null
      ? []
      : live.filter((o) => {
          if (!o.createdAt) return false
          const t = new Date(o.createdAt).getTime()
          return t >= prevSince && t < since
        })
  const prevRevenue = prevLive.reduce((s, o) => s + (o.total ?? 0), 0)
  const prevOrders = prevLive.length
  const prevAov = prevOrders > 0 ? prevRevenue / prevOrders : 0

  // ── Breakdowns (scoped) ───────────────────────────────────────────────────
  const statusCounts = rangeAll.reduce<Record<string, number>>((acc, o) => {
    const s = o.orderStatus ?? 'pending'
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  const cod = rangeLive.filter((o) => o.paymentMethod === 'cod').length
  const bank = rangeLive.filter((o) => o.paymentMethod === 'bank_transfer').length

  const productSales = new Map<string, { title: string; qty: number; revenue: number }>()
  const artistSales = new Map<string, number>()
  const areaSales = new Map<string, { orders: number; revenue: number }>()
  for (const o of rangeLive) {
    if (o.area) {
      const a = areaSales.get(o.area) ?? { orders: 0, revenue: 0 }
      a.orders += 1
      a.revenue += o.total ?? 0
      areaSales.set(o.area, a)
    }
    for (const item of o.items ?? []) {
      const key = item.productId ?? item.titleAtPurchase ?? 'unknown'
      const entry = productSales.get(key) ?? { title: item.titleAtPurchase ?? 'Unknown', qty: 0, revenue: 0 }
      const qty = item.quantity ?? 0
      entry.qty += qty
      entry.revenue += (item.priceAtPurchase ?? 0) * qty
      productSales.set(key, entry)

      const artist = (item.productId && artistOf.get(item.productId)) || 'Unknown'
      artistSales.set(artist, (artistSales.get(artist) ?? 0) + qty)
    }
  }
  const topProducts = [...productSales.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6)
  const topArtists = [...artistSales.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  const topAreas = [...areaSales.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 6)

  const lowStock = products
    .map((p) => ({ title: (p.title as string) ?? 'Untitled', stock: totalStock(p) }))
    .filter((p) => p.stock <= 3)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8)

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Sales Overview</h2>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/admin?range=${r.key}`}
              style={{
                fontSize: '0.72rem',
                padding: '0.25rem 0.6rem',
                borderRadius: 'var(--style-radius-s, 3px)',
                textDecoration: 'none',
                border: '1px solid var(--theme-elevation-150)',
                background: r.key === selected.key ? 'var(--theme-elevation-150)' : 'transparent',
                color: r.key === selected.key ? 'var(--theme-elevation-1000)' : 'var(--theme-elevation-600)',
              }}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {/* KPI cards (scoped to selected range; deltas vs the prior equal-length period) */}
      {(() => {
        const vsPrev = prevSince != null ? `vs prev ${selected.label.toLowerCase()}` : 'excl. cancelled'
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Kpi label={`Revenue · ${selected.label}`} value={money(revenue)} sub={`${orderCount} orders · ${vsPrev}`} delta={prevSince != null ? pctDelta(revenue, prevRevenue) : null} />
            <Kpi label="Orders" value={String(orderCount)} sub={vsPrev} delta={prevSince != null ? pctDelta(orderCount, prevOrders) : null} />
            <Kpi label="Avg order value" value={money(aov)} sub={vsPrev} delta={prevSince != null ? pctDelta(aov, prevAov) : null} />
            <Kpi label="Awaiting fulfilment" value={String(awaiting)} sub="pending / confirmed / in production" />
            <Kpi label="New custom requests" value={String(newRequests.totalDocs)} sub="status: new" />
          </div>
        )
      })()}

      {/* Revenue chart (fixed 30-day window) */}
      <div style={{ marginBottom: '1.5rem' }}>
        <RevenueChart orders={live} />
      </div>

      {/* Detail panels (scoped) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
        <Panel title={`Top products · ${selected.label}`}>
          {topProducts.length > 0 ? (
            topProducts.map((p, i) => <Row key={i} left={p.title} right={`${money(p.revenue)} · ${p.qty}`} />)
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--theme-elevation-500)' }}>No sales in range.</div>
          )}
        </Panel>

        <Panel title={`Top artists · ${selected.label}`}>
          {topArtists.length > 0 ? (
            topArtists.map(([name, qty], i) => <Row key={i} left={name} right={`${qty} sold`} />)
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--theme-elevation-500)' }}>No sales in range.</div>
          )}
        </Panel>

        <Panel title={`Sales by area · ${selected.label}`}>
          {topAreas.length > 0 ? (
            topAreas.map(([area, v], i) => <Row key={i} left={area} right={`${money(v.revenue)} · ${v.orders}`} />)
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--theme-elevation-500)' }}>No sales in range.</div>
          )}
        </Panel>

        <Panel title={`Orders by status · ${selected.label}`}>
          {Object.keys(STATUS_LABELS).filter((s) => statusCounts[s]).length > 0 ? (
            Object.keys(STATUS_LABELS)
              .filter((s) => statusCounts[s])
              .map((s) => <Row key={s} left={STATUS_LABELS[s]} right={String(statusCounts[s])} />)
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--theme-elevation-500)' }}>No orders in range.</div>
          )}
        </Panel>

        <Panel title={`Payment method · ${selected.label}`}>
          <Row left="Cash on Delivery" right={String(cod)} />
          <Row left="Bank Transfer" right={String(bank)} />
        </Panel>

        <Panel title="Low stock (≤ 3)">
          {lowStock.length > 0 ? (
            lowStock.map((p, i) => <Row key={i} left={p.title} right={p.stock === 0 ? 'Sold out' : `${p.stock} left`} />)
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--theme-elevation-500)' }}>All stocked up.</div>
          )}
        </Panel>
      </div>
    </div>
  )
}
