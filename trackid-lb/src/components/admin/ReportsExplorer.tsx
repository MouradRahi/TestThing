'use client'

import { useEffect, useState } from 'react'
import type { ReportResult } from '@/lib/reports/types'

const REPORT_TYPES = [
  { key: 'sales', label: 'Sales' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'customers', label: 'Customers' },
  { key: 'discounts', label: 'Discounts' },
  { key: 'payments', label: 'Payments' },
] as const
type ReportType = (typeof REPORT_TYPES)[number]['key']

const DIMENSIONS = [
  { key: 'period', label: 'By period' },
  { key: 'product', label: 'By product' },
  { key: 'artist', label: 'By artist' },
  { key: 'category', label: 'By category' },
  { key: 'area', label: 'By area' },
  { key: 'payment_method', label: 'By payment method' },
] as const

const GROUP_BYS = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
] as const

const DAY = 86_400_000
function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
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
const inputStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  padding: '0.35rem 0.5rem',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 'var(--style-radius-s, 3px)',
  background: 'var(--theme-input-bg, transparent)',
}

export function ReportsExplorer() {
  const [reportType, setReportType] = useState<ReportType>('sales')
  const [from, setFrom] = useState(() => toDateInput(new Date(Date.now() - 30 * DAY)))
  const [to, setTo] = useState(() => toDateInput(new Date()))
  const [dimension, setDimension] = useState<string>('period')
  const [groupBy, setGroupBy] = useState<string>('day')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ReportResult | null>(null)

  function buildQuery(): string {
    const sp = new URLSearchParams({ from, to })
    if (reportType === 'sales') {
      sp.set('dimension', dimension)
      if (dimension === 'period') sp.set('groupBy', groupBy)
    }
    return sp.toString()
  }

  async function run() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/reports/${reportType}?${buildQuery()}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to build report')
      setResult(data as ReportResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build report')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  // Load a default report (Sales, last 30 days) on first open.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    run()
  }, [])

  const exportHref = (format: 'csv' | 'xlsx' | 'pdf') =>
    `/api/admin/reports/${reportType}/export?${buildQuery()}&format=${format}`

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <div>
          <div style={labelStyle}>Report</div>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            style={inputStyle}
          >
            {REPORT_TYPES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={labelStyle}>From</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <div style={labelStyle}>To</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
        </div>

        {reportType === 'sales' && (
          <div>
            <div style={labelStyle}>Slice</div>
            <select value={dimension} onChange={(e) => setDimension(e.target.value)} style={inputStyle}>
              {DIMENSIONS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {reportType === 'sales' && dimension === 'period' && (
          <div>
            <div style={labelStyle}>Group by</div>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} style={inputStyle}>
              {GROUP_BYS.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <button type="button" className="btn btn--style-primary btn--size-small" onClick={run} disabled={loading}>
          {loading ? 'Running…' : 'Run report'}
        </button>

        {result && (
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
            <a href={exportHref('csv')} style={{ fontSize: '0.8rem' }}>
              CSV ↓
            </a>
            <a href={exportHref('xlsx')} style={{ fontSize: '0.8rem' }}>
              XLSX ↓
            </a>
            <a href={exportHref('pdf')} style={{ fontSize: '0.8rem' }}>
              PDF ↓
            </a>
          </div>
        )}
      </div>

      {error && (
        <div style={{ ...cardStyle, borderColor: 'var(--theme-error-500, #ef4444)', marginBottom: '1rem' }}>
          <span style={{ color: 'var(--theme-error-600, #dc2626)', fontSize: '0.85rem' }}>{error}</span>
        </div>
      )}

      {result && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>{result.title}</div>
              {result.subtitle && (
                <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-500)' }}>{result.subtitle}</div>
              )}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--theme-elevation-450)' }}>
              Generated {new Date(result.generatedAt).toLocaleString('en-US')}
            </div>
          </div>

          {result.summary && result.summary.length > 0 && (
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', margin: '0.75rem 0 1rem' }}>
              {result.summary.map((s, i) => (
                <div key={i}>
                  <div style={labelStyle}>{s.label}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {result.rows.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--theme-elevation-500)' }}>No data in this range.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--theme-elevation-150)' }}>
                    {result.columns.map((c) => (
                      <th
                        key={c.key}
                        style={{
                          textAlign: c.align ?? 'left',
                          padding: '0.4rem 0.5rem',
                          color: 'var(--theme-elevation-500)',
                          fontSize: '0.72rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--theme-elevation-100)' }}>
                      {result.columns.map((c) => (
                        <td key={c.key} style={{ textAlign: c.align ?? 'left', padding: '0.4rem 0.5rem' }}>
                          {row[c.key] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
