'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useCart } from '@/components/cart/CartContext'
import { Button } from '@/components/ui/Button'

type SizeOption = { label: string; stockQuantity: number }

type Props = {
  id: string
  slug: string
  title: string
  price: number
  imageUrl?: string
  outOfStock?: boolean
  maxQuantity?: number
  sizes?: SizeOption[]
}

export function AddToCart({ id, slug, title, price, imageUrl, outOfStock, maxQuantity, sizes = [] }: Props) {
  const { addItem, openCart } = useCart()
  const t = useTranslations('product')
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [sizeError, setSizeError] = useState(false)
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (outOfStock) {
    return (
      <Button fullWidth variant="secondary" disabled>
        {t('soldOut')}
      </Button>
    )
  }

  const hasSizes = sizes.length > 0
  const selectedSizeStock = hasSizes
    ? sizes.find((s) => s.label === selectedSize)?.stockQuantity ?? 0
    : null
  const max = hasSizes ? (selectedSizeStock ?? 0) : (maxQuantity ?? Infinity)
  const showQuantity = hasSizes ? selectedSize !== null && max > 1 : max > 1

  const selectSize = (label: string) => {
    setSelectedSize(label)
    setSizeError(false)
    setQuantity(1)
  }

  const handleAdd = () => {
    if (hasSizes && !selectedSize) {
      setSizeError(true)
      return
    }
    addItem(
      {
        id,
        slug,
        title,
        price,
        imageUrl,
        size: hasSizes ? selectedSize! : undefined,
        maxQuantity: hasSizes ? max : maxQuantity,
      },
      quantity,
    )
    openCart()
    setAdded(true)
    if (addedTimer.current) clearTimeout(addedTimer.current)
    addedTimer.current = setTimeout(() => setAdded(false), 1600)
  }

  return (
    <div className="space-y-4">
      {hasSizes && (
        <div className="space-y-2">
          <span className="block text-[10px] uppercase tracking-[0.2em] text-muted">{t('size')}</span>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => {
              const soldOut = size.stockQuantity <= 0
              const active = selectedSize === size.label
              return (
                <button
                  key={size.label}
                  onClick={() => selectSize(size.label)}
                  disabled={soldOut}
                  aria-pressed={active}
                  className={`min-w-11 h-10 px-3 border text-xs uppercase tracking-wider transition-colors ${
                    active
                      ? 'border-accent text-accent'
                      : soldOut
                        ? 'border-border text-muted/40 line-through cursor-not-allowed'
                        : 'border-border text-foreground hover:border-accent'
                  }`}
                >
                  {size.label}
                </button>
              )
            })}
          </div>
          {sizeError && (
            <p role="alert" className="text-xs text-red-400">
              {t('pickSize')}
            </p>
          )}
        </div>
      )}

      {showQuantity && (
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted">{t('quantity')}</span>
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            aria-label={t('decrease')}
            className="w-8 h-8 border border-border text-foreground hover:border-accent flex items-center justify-center text-sm disabled:opacity-30 transition-colors"
          >
            −
          </button>
          <span className="text-sm text-foreground w-5 text-center tabular-nums">{quantity}</span>
          <button
            onClick={() => setQuantity((q) => Math.min(max, q + 1))}
            disabled={quantity >= max}
            aria-label={t('increase')}
            className="w-8 h-8 border border-border text-foreground hover:border-accent flex items-center justify-center text-sm disabled:opacity-30 transition-colors"
          >
            +
          </button>
        </div>
      )}

      <Button fullWidth onClick={handleAdd}>
        {added ? t('added') : t('addToCart')}
      </Button>
    </div>
  )
}
