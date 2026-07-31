'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// OMT v1's manual-confirm action (ROADMAP F2 §2.4) — staff click this after
// the customer pays cash at an OMT branch. Calls the admin-only mark-paid
// route, which routes through the same applyPaymentEvent() a real webhook
// would use.
export function MarkOmtPaidButton({ orderId }: { orderId: string | number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onClick = async () => {
    if (!window.confirm('Mark this order as paid? This confirms the customer paid at an OMT branch.')) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/payments/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to mark as paid')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as paid')
      setLoading(false)
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <button type="button" className="btn btn--style-primary btn--size-small" onClick={onClick} disabled={loading}>
        {loading ? 'Marking…' : 'Mark as Paid'}
      </button>
      {error && <span style={{ color: 'var(--theme-error-600, #dc2626)', fontSize: '0.75rem' }}>{error}</span>}
    </span>
  )
}
