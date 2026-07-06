'use client'

import { useTranslations } from 'next-intl'
import { useCart } from '@/components/cart/CartContext'
import type { CartNotice } from '@/lib/cart'

function noticeText(t: ReturnType<typeof useTranslations<'cart'>>, n: CartNotice): string {
  const withSize = (title: string) => (n.size ? `${title} (${n.size})` : title)
  switch (n.type) {
    case 'removed':
      return n.title ? t('noticeRemoved', { title: withSize(n.title) }) : t('noticeRemovedGeneric')
    case 'sold_out':
      return t('noticeSoldOut', { title: withSize(n.title) })
    case 'reduced':
      return t('noticeReduced', { title: withSize(n.title), available: n.available })
  }
}

/**
 * Banner listing catalog changes the server detected while resolving the cart
 * (line removed / sold out / stock reduced). Rendered in the drawer and on the
 * cart page; dismissing clears it everywhere until the server reports again.
 */
export function CartNotices({ className = '' }: { className?: string }) {
  const { notices, dismissNotices } = useCart()
  const t = useTranslations('cart')

  if (notices.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`border border-accent/40 bg-accent/5 px-4 py-3 text-xs text-foreground/90 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <ul className="space-y-1.5">
          {notices.map((n, i) => (
            <li key={i} className="leading-relaxed">
              {noticeText(t, n)}
            </li>
          ))}
        </ul>
        <button
          onClick={dismissNotices}
          aria-label={t('noticeDismiss')}
          className="text-muted hover:text-foreground transition-colors shrink-0 p-0.5"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" />
          </svg>
        </button>
      </div>
    </div>
  )
}
