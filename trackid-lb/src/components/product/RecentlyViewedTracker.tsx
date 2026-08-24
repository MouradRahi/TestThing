'use client'

import { useEffect } from 'react'

// Fire-and-forget: records this product view in the httpOnly cookie
// api/recently-viewed manages. Renders nothing — mounted once per product
// page view.
export function RecentlyViewedTracker({ productId }: { productId: string | number }) {
  useEffect(() => {
    fetch('/api/recently-viewed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    }).catch(() => {})
  }, [productId])
  return null
}
