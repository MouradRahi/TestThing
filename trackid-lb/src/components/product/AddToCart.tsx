'use client'

import { useCart } from '@/components/cart/CartContext'
import { Button } from '@/components/ui/Button'

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
      <Button fullWidth variant="secondary" disabled>
        Sold Out
      </Button>
    )
  }

  return (
    <Button fullWidth onClick={() => addItem({ id, slug, title, price, imageUrl })}>
      Add to Cart
    </Button>
  )
}
