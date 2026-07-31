'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Admin refund action (ROADMAP F2 §2.6) — works for any paid order regardless
// of payment method; processRefund() on the server handles the provider-
// record side for card/OMT and the plain bookkeeping side for COD/bank.
export function RefundButton({
  orderId,
  total,
  refundedAmount,
}: {
  orderId: string | number
  total: number
  refundedAmount: number
}) {
  const router = useRouter()
  const remaining = Math.round((total - refundedAmount) * 100) / 100
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(String(remaining))
  const [restock, setRestock] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (remaining <= 0) {
    return <span style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-400)' }}>Fully refunded</span>
  }

  if (!open) {
    return (
      <button type="button" className="btn btn--style-secondary btn--size-small" onClick={() => setOpen(true)}>
        Refund
      </button>
    )
  }

  const submit = async () => {
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount')
      return
    }
    if (!window.confirm(`Refund $${amt.toFixed(2)} for this order${restock ? ' and restock its items' : ''}?`)) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amount: amt, restock }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Refund failed')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refund failed')
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
      <input
        type="number"
        step="0.01"
        min="0"
        max={remaining}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{
          width: '80px',
          padding: '0.25rem 0.4rem',
          fontSize: '0.8rem',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 'var(--style-radius-s, 3px)',
          background: 'var(--theme-input-bg, transparent)',
        }}
      />
      <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
        Restock
      </label>
      <button type="button" className="btn btn--style-primary btn--size-small" onClick={submit} disabled={loading}>
        {loading ? 'Refunding…' : 'Confirm'}
      </button>
      <button type="button" className="btn btn--style-secondary btn--size-small" onClick={() => setOpen(false)} disabled={loading}>
        Cancel
      </button>
      {error && <span style={{ color: 'var(--theme-error-600, #dc2626)', fontSize: '0.75rem' }}>{error}</span>}
    </div>
  )
}
