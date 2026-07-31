'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/Button'
import { formatPrice } from '@/lib/format'

type Props = { providerRef: string; orderNumber: string; amount: number }

export function MockPayForm({ providerRef, orderNumber, amount }: Props) {
  const t = useTranslations('payment')
  const router = useRouter()
  const [loading, setLoading] = useState<'success' | 'failure' | null>(null)
  const [error, setError] = useState('')

  const simulate = async (outcome: 'success' | 'failure') => {
    setLoading(outcome)
    setError('')
    try {
      const res = await fetch('/api/payments/mock/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerRef, outcome }),
      })
      if (!res.ok) throw new Error('Simulation failed')
      router.push(`/order/${orderNumber}`)
    } catch {
      setError(t('simulateError'))
      setLoading(null)
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-24 text-center space-y-8">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-accent mb-3">{t('testBadge')}</p>
        <h1 className="text-2xl font-bold text-foreground mb-2">{t('payAmount', { amount: formatPrice(amount) })}</h1>
        <p className="text-xs text-muted font-mono">{orderNumber}</p>
      </div>
      <div className="space-y-3">
        <Button onClick={() => simulate('success')} disabled={loading !== null} fullWidth>
          {loading === 'success' ? t('processing') : t('simulateSuccess')}
        </Button>
        <Button onClick={() => simulate('failure')} disabled={loading !== null} variant="secondary" fullWidth>
          {loading === 'failure' ? t('processing') : t('simulateFailure')}
        </Button>
      </div>
      {error && <p className="text-sm text-red-400 border border-red-400/30 px-3 py-2">{error}</p>}
    </div>
  )
}
