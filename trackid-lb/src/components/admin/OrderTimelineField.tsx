'use client'

import { useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

type TimelineEntry = { at: string; label: string; detail?: string }

// Order-timeline UI (ROADMAP F2 §2.6 leftover) — a `ui` field on Orders,
// same pattern as InvoiceDownloadField/StockAdjustField. Fetches the merged
// Payments + AuditLog view from /api/admin/orders/[id]/timeline on demand
// (collapsed by default — most orders are COD with no payment events, so
// eagerly loading this on every order-list-to-detail navigation would be
// wasted work).
export function OrderTimelineField() {
  const { id } = useDocumentInfo()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null)
  const [error, setError] = useState('')

  if (!id) return null // "create new" screen — orders are only ever created by the storefront API

  const load = async () => {
    setOpen(true)
    if (entries) return // already loaded
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/orders/${id}/timeline`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not load timeline.')
      setEntries(data.entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load timeline.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <div style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn btn--style-secondary btn--size-small" onClick={load}>
          View Timeline
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        marginBottom: '1rem',
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 'var(--style-radius-m, 4px)',
        padding: '0.75rem 1rem',
        maxWidth: '480px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <strong style={{ fontSize: '0.85rem' }}>Timeline</strong>
        <button type="button" className="btn btn--style-secondary btn--size-small" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {loading && <div style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-600)' }}>Loading…</div>}
      {error && <div style={{ fontSize: '0.8rem', color: '#c0392b' }}>{error}</div>}
      {entries && entries.length === 0 && (
        <div style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-600)' }}>
          No payment or status-change events recorded for this order.
        </div>
      )}
      {entries && entries.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {entries.map((e, i) => (
            <li
              key={i}
              style={{
                borderLeft: '2px solid var(--theme-elevation-150)',
                paddingLeft: '0.75rem',
                marginBottom: '0.6rem',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ color: 'var(--theme-elevation-500)', fontSize: '0.7rem' }}>{new Date(e.at).toLocaleString()}</div>
              <div>{e.label}</div>
              {e.detail && <div style={{ color: 'var(--theme-elevation-600)', fontSize: '0.75rem' }}>{e.detail}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
