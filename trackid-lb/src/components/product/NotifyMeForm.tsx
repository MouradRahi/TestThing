'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'

export function NotifyMeForm({ productId }: { productId: string }) {
  const t = useTranslations('product')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/back-in-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: Number(productId), email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('genericError'))
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('genericError'))
    } finally {
      setLoading(false)
    }
  }

  if (done) return <p className="text-xs text-accent">{t('notifyMeSubmitted')}</p>

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          className="flex-1 min-w-0 bg-bg border border-border px-3 py-2 text-xs text-foreground focus:border-accent outline-none"
        />
        <Button type="submit" variant="secondary" disabled={loading}>
          {loading ? '…' : t('notifyMe')}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </form>
  )
}
