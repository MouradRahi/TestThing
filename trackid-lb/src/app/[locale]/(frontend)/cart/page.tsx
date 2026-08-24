'use client'

import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useCart } from '@/components/cart/CartContext'
import { CartNotices } from '@/components/cart/CartNotices'
import { FreeDeliveryNudge } from '@/components/cart/FreeDeliveryNudge'
import { RecentlyViewedStrip } from '@/components/product/RecentlyViewedStrip'
import { Button } from '@/components/ui/Button'
import { formatPrice, formatLBP } from '@/lib/format'

export default function CartPage() {
  const { items, isLoading, removeItem, updateQuantity, total, itemCount, emptyCartMessage, currency } = useCart()
  const t = useTranslations('cart')
  const tp = useTranslations('product')

  // Server cart still loading — skeleton, never a false "empty" flash
  if (isLoading && items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12" aria-busy="true" aria-label={t('loading')}>
        <div className="h-8 w-32 bg-surface animate-pulse mb-10" />
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-4 py-6 border-b border-border">
            <div className="w-20 h-24 bg-surface animate-pulse shrink-0" />
            <div className="flex-1 space-y-3 pt-1">
              <div className="h-4 w-2/3 bg-surface animate-pulse" />
              <div className="h-3 w-1/3 bg-surface animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-6 py-32 text-center">
        <CartNotices className="mb-8 text-start" />
        <h1 className="text-2xl font-bold text-foreground mb-3">{t('emptyTitle')}</h1>
        <p className="text-muted text-sm mb-10">{emptyCartMessage}</p>
        <Button href="/shop">{t('browseShop')}</Button>
        <RecentlyViewedStrip />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <CartNotices className="mb-8" />
      <FreeDeliveryNudge className="mb-8" />
      <div className="flex items-baseline justify-between mb-10">
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <span className="text-xs text-muted uppercase tracking-widest">
          {t('count', { count: itemCount })}
        </span>
      </div>

      <div className="space-y-0">
        {items.map((item) => (
          <div key={item.key} className="flex gap-4 py-6 border-b border-border">
            <div className="w-20 h-24 bg-surface border border-border shrink-0 relative overflow-hidden">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              ) : null}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground font-medium leading-snug">{item.title}</p>
              <p className="text-xs text-muted mt-1">
                {item.size && <span className="me-2 uppercase">{tp('size')}: {item.size}</span>}
                {t('each', { price: formatPrice(item.price) })}
              </p>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={() => updateQuantity(item.key, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                  className="w-7 h-7 border border-border text-foreground hover:border-accent flex items-center justify-center text-sm disabled:opacity-30 transition-colors"
                >
                  −
                </button>
                <span className="text-sm text-foreground w-4 text-center tabular-nums">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(item.key, item.quantity + 1)}
                  disabled={item.maxQuantity != null && item.quantity >= item.maxQuantity}
                  className="w-7 h-7 border border-border text-foreground hover:border-accent flex items-center justify-center text-sm disabled:opacity-30 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
            <div className="text-right flex flex-col justify-between">
              <p className="text-sm text-foreground tabular-nums">
                {formatPrice(item.price * item.quantity)}
              </p>
              <button
                onClick={() => removeItem(item.key)}
                className="text-[10px] uppercase tracking-widest text-muted hover:text-foreground transition-colors"
              >
                {t('removeShort')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="pt-8 space-y-3">
        <div className="flex justify-between items-baseline text-sm text-muted">
          <span>{t('subtotal')}</span>
          <span className="text-end">
            <span className="tabular-nums">{formatPrice(total)}</span>
            {currency.mode === 'both' && currency.exchangeRate && (
              <span className="block text-[10px] tabular-nums">{formatLBP(total, currency.exchangeRate)}</span>
            )}
          </span>
        </div>
        <div className="flex justify-between text-xs text-muted">
          <span>{t('delivery')}</span>
          <span>{t('deliveryCalc')}</span>
        </div>
      </div>

      <Button href="/checkout" fullWidth className="mt-8">{t('checkout')}</Button>

      <div className="text-center mt-4">
        <Link href="/shop" className="text-[10px] uppercase tracking-widest text-muted hover:text-foreground transition-colors">
          {t('continueShopping')}
        </Link>
      </div>
    </div>
  )
}
