'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'

type Props = { orderNumber: string; initialStatus: string }

const POLL_MS = 2500
const MAX_POLLS = 24 // ~60s — long enough for a webhook to land, short enough not to poll forever

// The customer's return-redirect never trusts the browser — this just shows
// "confirming…" and polls our own order status until a verified webhook
// (src/lib/payments/service.ts) flips it, then refreshes the page for the
// full server-rendered view (ROADMAP F1 §2.1).
export function PaymentConfirmingBanner({ orderNumber, initialStatus }: Props) {
  const t = useTranslations('payment')
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)

  useEffect(() => {
    if (status !== 'awaiting_payment') return
    let cancelled = false
    let attempts = 0
    const interval = setInterval(async () => {
      attempts += 1
      try {
        const res = await fetch(`/api/orders/${orderNumber}/status`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled && data.paymentStatus && data.paymentStatus !== 'awaiting_payment') {
            setStatus(data.paymentStatus)
            router.refresh()
          }
        }
      } catch {
        // network hiccup — try again on the next tick
      }
      if (attempts >= MAX_POLLS) clearInterval(interval)
    }, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [status, orderNumber, router])

  if (status === 'awaiting_payment') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="border border-accent/30 bg-surface px-4 py-3.5 text-xs text-foreground flex items-center gap-3 mb-6"
      >
        <span className="inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
        <span>{t('confirming')}</span>
      </div>
    )
  }
  if (status === 'failed') {
    return (
      <div role="status" className="border border-red-400/30 bg-surface px-4 py-3.5 text-xs text-red-400 mb-6">
        {t('failedBody')}
      </div>
    )
  }
  if (status === 'expired') {
    return (
      <div role="status" className="border border-red-400/30 bg-surface px-4 py-3.5 text-xs text-red-400 mb-6">
        {t('expiredBody')}
      </div>
    )
  }
  return null
}
