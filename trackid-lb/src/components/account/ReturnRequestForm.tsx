'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { TextareaField } from '@/components/ui/FormField'
import { formatPrice } from '@/lib/format'

type OrderItem = {
  productId: string
  titleAtPurchase: string
  size?: string | null
  priceAtPurchase: number
  quantity: number
}

export function ReturnRequestForm({ orderId, items }: { orderId: number; items: OrderItem[] }) {
  const t = useTranslations('returns')
  const router = useRouter()
  const [selected, setSelected] = useState<Record<number, number>>({}) // index -> quantity (0 = not selected)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const toggle = (index: number, max: number) => {
    setSelected((s) => {
      const next = { ...s }
      if (next[index]) delete next[index]
      else next[index] = max
      return next
    })
  }

  const setQty = (index: number, qty: number, max: number) => {
    setSelected((s) => ({ ...s, [index]: Math.max(1, Math.min(max, qty)) }))
  }

  const submit = async () => {
    const chosenIndexes = Object.keys(selected).map(Number)
    if (chosenIndexes.length === 0) {
      setError(t('selectAtLeastOne'))
      return
    }
    if (!reason.trim()) {
      setError(t('reasonRequired'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          reason,
          items: chosenIndexes.map((i) => ({
            productId: items[i].productId,
            size: items[i].size ?? undefined,
            quantity: selected[i],
          })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('genericError'))
      setDone(true)
      setTimeout(() => router.push('/account'), 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('genericError'))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return <p className="text-sm text-foreground">{t('requestSubmitted')}</p>
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-4 border border-border p-4">
            <input
              type="checkbox"
              checked={!!selected[i]}
              onChange={() => toggle(i, item.quantity)}
              className="shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">
                {item.titleAtPurchase}
                {item.size ? ` (${item.size})` : ''}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {formatPrice(item.priceAtPurchase)} · {t('purchasedQty', { qty: item.quantity })}
              </p>
            </div>
            {selected[i] > 0 && item.quantity > 1 && (
              <input
                type="number"
                min={1}
                max={item.quantity}
                value={selected[i]}
                onChange={(e) => setQty(i, Number(e.target.value), item.quantity)}
                className="w-16 text-sm border border-border bg-bg px-2 py-1"
              />
            )}
          </div>
        ))}
      </div>

      <TextareaField
        label={t('reason')}
        name="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
        rows={4}
      />

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <Button type="button" onClick={submit} disabled={loading}>
        {loading ? t('submitting') : t('submitRequest')}
      </Button>
    </div>
  )
}
