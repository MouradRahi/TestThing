'use client'

import { useTranslations } from 'next-intl'
import { useCart } from '@/components/cart/CartContext'
import { formatPrice } from '@/lib/format'

// E2 (ENHANCEMENTS.md) — classic AOV lever: "You're $12 away from free
// delivery" with a thin progress bar, switching to a checkmark once the
// threshold is cleared. Renders nothing when the store has no threshold
// configured (or zones aren't configured at all — see the layout's
// freeDeliveryThreshold prop) or the cart is empty, so it never promises
// something the checkout can't back up.
export function FreeDeliveryNudge({ className = '' }: { className?: string }) {
  const { total, itemCount, freeDeliveryThreshold } = useCart()
  const t = useTranslations('cart')

  if (!freeDeliveryThreshold || freeDeliveryThreshold <= 0 || itemCount === 0) return null

  const remaining = freeDeliveryThreshold - total
  const pct = Math.min(100, Math.max(0, (total / freeDeliveryThreshold) * 100))

  return (
    <div className={className}>
      <p className="text-xs text-foreground mb-1.5">
        {remaining > 0 ? t('freeDeliveryProgress', { amount: formatPrice(remaining) }) : t('freeDeliveryUnlocked')}
      </p>
      <div className="h-1 bg-border overflow-hidden">
        <div
          className="h-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
