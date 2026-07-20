'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'

// Frontend-group error boundary. Catches render/data errors in any storefront
// route and offers a retry instead of a blank screen.
export default function FrontendError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errors')

  useEffect(() => {
    // Surfaces in server logs / browser console for debugging
    console.error(error)
  }, [error])

  return (
    <div className="max-w-2xl mx-auto px-6 py-28 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-muted mb-6">{t('errorEyebrow')}</p>
      <h1 className="text-2xl font-bold text-foreground mb-4 leading-tight">{t('errorTitle')}</h1>
      <p className="text-muted mb-10">{t('errorBody')}</p>
      <div className="flex gap-3 justify-center">
        <Button onClick={reset}>{t('tryAgain')}</Button>
        <Button href="/shop" variant="secondary">
          {t('backToShop')}
        </Button>
      </div>
    </div>
  )
}
