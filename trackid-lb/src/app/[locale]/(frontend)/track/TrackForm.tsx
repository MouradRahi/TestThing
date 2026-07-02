'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/FormField'

export function TrackForm() {
  const router = useRouter()
  const [orderNumber, setOrderNumber] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = orderNumber.trim().toUpperCase()
    if (!trimmed) return
    setLoading(true)
    router.push(`/order/${encodeURIComponent(trimmed)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field
        label="Order Number"
        name="orderNumber"
        value={orderNumber}
        onChange={(e) => setOrderNumber(e.target.value)}
        required
        placeholder="e.g. TRK-123456-AB12"
        autoComplete="off"
      />
      <Button type="submit" fullWidth disabled={loading}>
        {loading ? 'Looking up…' : 'Track Order'}
      </Button>
    </form>
  )
}
