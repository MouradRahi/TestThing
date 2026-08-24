'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { useCart } from '@/components/cart/CartContext'
import { CartNotices } from '@/components/cart/CartNotices'
import { FreeDeliveryNudge } from '@/components/cart/FreeDeliveryNudge'
import { formatPrice, formatLBP } from '@/lib/format'
import { useFocusTrap } from '@/lib/useFocusTrap'

// Slide-over mini-cart. Opens on add-to-cart (and from the nav cart button) so
// customers get immediate confirmation without a full-page navigation. The
// full /cart and /checkout pages remain the source of truth.
export function CartDrawer() {
  const { items, isLoading, isOpen, closeCart, removeItem, updateQuantity, total, itemCount, emptyCartMessage, currency } = useCart()
  const t = useTranslations('cart')
  const tp = useTranslations('product')
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useFocusTrap(isOpen, panelRef)

  // Esc to close; lock body scroll and move focus into the panel while open
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusReturn = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      focusReturn?.focus?.()
    }
  }, [isOpen, closeCart])

  return (
    <div
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-[60] ${isOpen ? '' : 'pointer-events-none'}`}
    >
      {/* Overlay */}
      <div
        onClick={closeCart}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        className={`absolute top-0 right-0 h-full w-full max-w-md bg-bg border-l border-border flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-border shrink-0">
          <h2 className="text-xs uppercase tracking-[0.2em] text-foreground">
            {t('title')}{itemCount > 0 ? ` · ${itemCount}` : ''}
          </h2>
          <button
            ref={closeRef}
            onClick={closeCart}
            aria-label={t('close')}
            className="text-muted hover:text-foreground transition-colors p-1 -mr-1"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M3 3l12 12M15 3L3 15" />
            </svg>
          </button>
        </div>

        <CartNotices className="mx-4 mt-4" />
        <FreeDeliveryNudge className="mx-4 mt-4" />

        {isLoading && items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center" aria-busy="true">
            <p className="text-muted text-xs uppercase tracking-widest animate-pulse">{t('loading')}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-5">
            <p className="text-muted text-sm">{emptyCartMessage}</p>
            <Link
              href="/shop"
              onClick={closeCart}
              className="text-xs uppercase tracking-widest text-accent hover:text-accent-hover transition-colors"
            >
              {t('browse')}
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto divide-y divide-border">
              {items.map((item) => (
                <li key={item.key} className="flex gap-3 p-4">
                  <div className="relative w-16 h-20 bg-surface border border-border shrink-0 overflow-hidden">
                    {item.imageUrl && (
                      <Image src={item.imageUrl} alt={item.title} fill className="object-cover" sizes="64px" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <Link
                        href={`/product/${item.slug}`}
                        onClick={closeCart}
                        className="text-sm text-foreground hover:text-accent transition-colors leading-snug line-clamp-2"
                      >
                        {item.title}
                      </Link>
                      <button
                        onClick={() => removeItem(item.key)}
                        aria-label={t('remove', { title: item.title })}
                        className="text-muted hover:text-foreground transition-colors shrink-0 -mt-0.5 p-0.5"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                          <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" />
                        </svg>
                      </button>
                    </div>
                    {item.size && (
                      <p className="text-[10px] uppercase tracking-wider text-muted mt-1">{tp('size')}: {item.size}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.key, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label={t('decrease')}
                          className="w-6 h-6 border border-border text-foreground hover:border-accent flex items-center justify-center text-xs disabled:opacity-30 transition-colors"
                        >
                          −
                        </button>
                        <span className="text-xs text-foreground w-5 text-center tabular-nums">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.key, item.quantity + 1)}
                          disabled={item.maxQuantity != null && item.quantity >= item.maxQuantity}
                          aria-label={t('increase')}
                          className="w-6 h-6 border border-border text-foreground hover:border-accent flex items-center justify-center text-xs disabled:opacity-30 transition-colors"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm text-foreground tabular-nums">{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-border p-5 space-y-4 shrink-0">
              <div className="flex justify-between items-baseline text-sm">
                <span className="text-muted uppercase tracking-widest text-xs">{t('subtotal')}</span>
                <span className="text-end">
                  <span className="text-foreground tabular-nums">{formatPrice(total)}</span>
                  {currency.mode === 'both' && currency.exchangeRate && (
                    <span className="block text-[10px] text-muted tabular-nums">
                      {formatLBP(total, currency.exchangeRate)}
                    </span>
                  )}
                </span>
              </div>
              <p className="text-[10px] text-muted/70">{t('deliveryNote')}</p>
              <Link
                href="/checkout"
                onClick={closeCart}
                className="block w-full text-center bg-accent text-on-accent text-xs uppercase tracking-widest font-medium py-3.5 hover:bg-accent-hover transition-colors"
              >
                {t('checkout')}
              </Link>
              <Link
                href="/cart"
                onClick={closeCart}
                className="block text-center text-xs uppercase tracking-widest text-muted hover:text-foreground transition-colors"
              >
                {t('viewFullCart')}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
