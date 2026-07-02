'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { useCart } from '@/components/cart/CartContext'

export function LogoutButton() {
  const t = useTranslations('account')
  const router = useRouter()
  const { refreshCart } = useCart()
  const [loading, setLoading] = useState(false)

  const logout = async () => {
    setLoading(true)
    await fetch('/api/account/logout', { method: 'POST' }).catch(() => {})
    refreshCart()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className="text-[10px] uppercase tracking-widest text-muted hover:text-foreground transition-colors disabled:opacity-50"
    >
      {t('logout')}
    </button>
  )
}
