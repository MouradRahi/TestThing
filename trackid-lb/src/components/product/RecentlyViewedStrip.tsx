'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { formatPrice, formatLBP } from '@/lib/format'
import type { CurrencyDisplay } from '@/lib/site-settings'

type Item = {
  id: string | number
  slug: string
  title: string
  price: number
  imageUrl: string | null
  imageAlt: string | null
  soldOut: boolean
}

// E9 (ENHANCEMENTS.md) — client-fetch, not a Server Component reading
// cookies() directly (that would force the host page dynamic and break ISR
// on product pages — see the route handler's own comment for the full
// reasoning). Renders nothing until data resolves and nothing at all if the
// cookie is empty, so it never causes layout shift on a fresh visitor.
export function RecentlyViewedStrip({ excludeId }: { excludeId?: string | number }) {
  const locale = useLocale()
  const t = useTranslations('shop')
  const tp = useTranslations('product')
  const [items, setItems] = useState<Item[]>([])
  const [currency, setCurrency] = useState<CurrencyDisplay>({ mode: 'usd_only', exchangeRate: null })

  useEffect(() => {
    const params = new URLSearchParams({ locale })
    if (excludeId != null) params.set('exclude', String(excludeId))
    fetch(`/api/recently-viewed?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.products)) setItems(d.products)
        if (d?.currency) setCurrency(d.currency)
      })
      .catch(() => {})
  }, [locale, excludeId])

  if (items.length === 0) return null

  return (
    <div className="mt-16">
      <h2 className="text-xs uppercase tracking-[0.2em] text-muted mb-4">{t('recentlyViewed')}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {items.map((item) => (
          <Link key={item.id} href={`/product/${item.slug}`} className="group block">
            <div className="aspect-[3/4] bg-surface overflow-hidden relative border border-border group-hover:border-accent/30 transition-colors duration-300">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.imageAlt || item.title}
                  fill
                  className={`object-cover group-hover:scale-[1.03] transition-transform duration-500 ${item.soldOut ? 'opacity-50' : ''}`}
                  sizes="(max-width: 640px) 50vw, 25vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted text-xs uppercase tracking-widest">
                  {tp('noImage')}
                </div>
              )}
              {item.soldOut && (
                <span className="absolute top-2 start-2 bg-bg/90 border border-border text-muted text-[10px] uppercase tracking-[0.2em] px-2 py-1">
                  {tp('soldOut')}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-foreground truncate">{item.title}</p>
            <p className="text-xs text-muted">
              {formatPrice(item.price)}
              {currency.mode === 'both' && currency.exchangeRate && (
                <span className="block text-[10px]">{formatLBP(item.price, currency.exchangeRate)}</span>
              )}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
