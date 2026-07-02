'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'

// Server-backed save-for-later. Guests are sent to sign in first.
// Pass `fetchState` (e.g. on the static product page) to resolve login + saved
// state client-side on mount, keeping the host page statically rendered.
export function WishlistButton({
  productId,
  initialSaved = false,
  isLoggedIn: isLoggedInProp,
  fetchState = false,
  onRemoved,
}: {
  productId: string
  initialSaved?: boolean
  isLoggedIn?: boolean
  fetchState?: boolean
  onRemoved?: () => void
}) {
  const t = useTranslations('account')
  const router = useRouter()
  const [saved, setSaved] = useState(initialSaved)
  const [isLoggedIn, setIsLoggedIn] = useState(isLoggedInProp ?? false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!fetchState) return
    let alive = true
    fetch(`/api/account/wishlist?productId=${encodeURIComponent(productId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        setIsLoggedIn(Boolean(d.isLoggedIn))
        setSaved(Boolean(d.inWishlist))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [fetchState, productId])

  const toggle = async () => {
    if (!isLoggedIn) {
      router.push('/account/login')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/account/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSaved(data.inWishlist)
        if (!data.inWishlist) onRemoved?.()
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-pressed={saved}
      className={`inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] transition-colors disabled:opacity-50 ${
        saved ? 'text-accent' : 'text-muted hover:text-foreground'
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M12 21s-7.5-4.9-9.6-9.3C1 8.5 2.5 5.5 5.5 5.5c1.9 0 3.3 1.1 4.1 2.4C10.2 6.6 11.6 5.5 13.5 5.5c3 0 4.5 3 3.1 6.2C19.5 16.1 12 21 12 21z" transform="translate(-0.5)" />
      </svg>
      {saved ? t('wishlistSaved') : t('wishlistSave')}
    </button>
  )
}
