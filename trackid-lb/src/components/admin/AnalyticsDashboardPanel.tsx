import React from 'react'
import Link from 'next/link'
import { getPayload } from '@/lib/payload'
import { getPool } from '@/lib/db-pool'
import { isAdmin } from '@/lib/access'
import { buildFunnel, buildCohorts, buildPaymentMix } from '@/lib/reports/dashboard-v3'

// Dashboard v3 (ROADMAP Part 4 §4.3) — conversion funnel, cohort/repeat-
// purchase view, payment-method mix + failure rate. Own query param
// (`v3range`) so it doesn't collide with SalesDashboard's `?range=`, since
// both panels render on the same /admin page.
const RANGES = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
] as const
type RangeKey = (typeof RANGES)[number]['key']

const DAY = 86_400_000
function sinceFor(key: RangeKey): Date {
  const days = key === '7d' ? 7 : key === '30d' ? 30 : 90
  return new Date(Date.now() - days * DAY)
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

export async function AnalyticsDashboardPanel(props: {
  user?: unknown
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  if (!isAdmin(props.user)) return null

  const rangeParam = typeof props.searchParams?.v3range === 'string' ? props.searchParams.v3range : '30d'
  const selected = RANGES.find((r) => r.key === rangeParam) ?? RANGES[1]
  const from = sinceFor(selected.key)
  const to = new Date()

  const payload = await getPayload()
  const pool = getPool(payload)
  if (!pool) return null

  const [funnel, cohorts, paymentMix] = await Promise.all([
    buildFunnel(pool, from, to),
    buildCohorts(pool),
    buildPaymentMix(pool, from, to),
  ])

  const recentCohorts = cohorts.slice(-12)

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Analytics (v3)</h2>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/admin?v3range=${r.key}`}
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Conversion funnel · {selected.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            {funnel.map((stage, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.85rem' }}>
                <span>{stage.label}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {stage.count.toLocaleString('en-US')}
                  {stage.pctOfPrevious != null && (
                    <span style={{ color: 'var(--theme-elevation-500)', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                      ({Math.round(stage.pctOfPrevious)}%)
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--theme-elevation-450)', marginTop: '0.5rem' }}>
            Sessions: own page-view counter. Percentages are of the previous stage.
          </div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Payment mix &amp; failure rate · {selected.label}</div>
          {paymentMix.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--theme-elevation-500)', marginTop: '0.5rem' }}>No orders in range.</div>
          ) : (
            <div style={{ marginTop: '0.5rem' }}>
              {paymentMix.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.2rem 0' }}>
                  <span>{m.method}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--theme-elevation-650)' }}>
                    {m.attempted} attempted
                    {m.failureRate != null && ` · ${Math.round(m.failureRate * 100)}% failed`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Cohorts (repeat-purchase by signup month)</div>
        {recentCohorts.length === 0 ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--theme-elevation-500)', marginTop: '0.5rem' }}>No customer data yet.</div>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--theme-elevation-150)' }}>
                  <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem', color: 'var(--theme-elevation-500)', fontSize: '0.72rem' }}>Month</th>
                  <th style={{ textAlign: 'right', padding: '0.3rem 0.5rem', color: 'var(--theme-elevation-500)', fontSize: '0.72rem' }}>Customers</th>
                  <th style={{ textAlign: 'right', padding: '0.3rem 0.5rem', color: 'var(--theme-elevation-500)', fontSize: '0.72rem' }}>Repeat rate</th>
                  <th style={{ textAlign: 'right', padding: '0.3rem 0.5rem', color: 'var(--theme-elevation-500)', fontSize: '0.72rem' }}>Avg orders</th>
                </tr>
              </thead>
              <tbody>
                {recentCohorts.map((c, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--theme-elevation-100)' }}>
                    <td style={{ padding: '0.3rem 0.5rem' }}>{c.cohortMonth}</td>
                    <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>{c.customers}</td>
                    <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>{Math.round(c.repeatRate * 100)}%</td>
                    <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>{c.avgOrders.toFixed(1)}</td>
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
