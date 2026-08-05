'use client'

import { useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'

// Stock-adjustment action (ROADMAP Part 3.3) — a `ui` field on Products,
// same "field-level custom component reading the current doc" pattern as
// InvoiceDownloadField.tsx on Orders. Reads sizes/title from the loaded
// document (useDocumentInfo) for display only — the actual adjustment always
// re-reads live stock from the DB server-side (src/app/api/admin/products/
// adjust-stock/route.ts), so a stale client read can't cause a wrong delta.
const REASONS = [
  { value: 'received', label: 'Received' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'correction', label: 'Correction' },
  { value: 'other', label: 'Other' },
]

export function StockAdjustField() {
  const { id, data } = useDocumentInfo()
  const router = useRouter()
  const sizes: Array<{ label?: string }> = Array.isArray(data?.sizes) ? data.sizes : []

  const [open, setOpen] = useState(false)
  const [size, setSize] = useState(sizes[0]?.label ?? '')
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('received')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  if (!id) return null // "create new" screen — no product to adjust yet

  const submit = async () => {
    const n = Number(delta)
    if (!Number.isInteger(n) || n === 0) {
      setMessage('Enter a non-zero whole number (e.g. 5 or -2).')
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/products/adjust-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: id, size: sizes.length > 0 ? size : undefined, delta: n, reason }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result.error || 'Adjustment failed')
      setMessage(`Updated: ${result.before} → ${result.after}`)
      setDelta('')
      router.refresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Adjustment failed')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <div style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn btn--style-secondary btn--size-small" onClick={() => setOpen(true)}>
          Adjust Stock
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
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      {sizes.length > 0 && (
        <select value={size} onChange={(e) => setSize(e.target.value)} style={{ fontSize: '0.85rem', padding: '0.3rem' }}>
          {sizes.map((s, i) => (
            <option key={i} value={s.label}>
              {s.label}
            </option>
          ))}
        </select>
      )}
      <input
        type="number"
        step="1"
        placeholder="±qty"
        value={delta}
        onChange={(e) => setDelta(e.target.value)}
        style={{ width: '90px', fontSize: '0.85rem', padding: '0.3rem' }}
      />
      <select value={reason} onChange={(e) => setReason(e.target.value)} style={{ fontSize: '0.85rem', padding: '0.3rem' }}>
        {REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <button type="button" className="btn btn--style-primary btn--size-small" onClick={submit} disabled={loading}>
        {loading ? 'Saving…' : 'Apply'}
      </button>
      <button type="button" className="btn btn--style-secondary btn--size-small" onClick={() => setOpen(false)} disabled={loading}>
        Close
      </button>
      {message && <span style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-600)' }}>{message}</span>}
    </div>
  )
}
