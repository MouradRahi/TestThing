'use client'

import { useCart } from '@/components/cart/CartContext'

type Props = {
  id: string
  slug: string
  title: string
  price: number
  imageUrl?: string
  outOfStock?: boolean
}

export function AddToCart({ id, slug, title, price, imageUrl, outOfStock }: Props) {
  const { addItem } = useCart()

  if (outOfStock) {
    return (
      <button
        disabled
        className="w-full py-3.5 text-xs uppercase tracking-[0.2em] text-muted border border-border cursor-not-allowed"
      >
        Sold Out
      </button>
    )
  }

  return (
    <button
      onClick={() => addItem({ id, slug, title, price, imageUrl })}
      className="w-full py-3.5 text-xs uppercase tracking-[0.2em] bg-accent text-bg font-semibold hover:bg-accent-hover transition-colors"
    >
      Add to Cart
    </button>
  )
}
