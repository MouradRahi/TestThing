'use client'

import { useEffect } from 'react'
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
  useEffect(() => {
    // Surfaces in server logs / browser console for debugging
    console.error(error)
  }, [error])

  return (
    <div className="max-w-2xl mx-auto px-6 py-28 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-muted mb-6">Something went wrong</p>
      <h1 className="text-2xl font-bold text-foreground mb-4 leading-tight">This page hit an error</h1>
      <p className="text-muted mb-10">Please try again, or head back to the shop.</p>
      <div className="flex gap-3 justify-center">
        <Button onClick={reset}>Try again</Button>
        <Button href="/shop" variant="secondary">
          Back to shop
        </Button>
      </div>
    </div>
  )
}
