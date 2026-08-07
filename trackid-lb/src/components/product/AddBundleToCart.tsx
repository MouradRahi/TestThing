'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useCart } from '@/components/cart/CartContext'
import { Button } from '@/components/ui/Button'

type BundleItem = { id: string; slug: string; title: string; price: number; imageUrl?: string; quantity: number }

// Adds each bundle component at its own real price (ROADMAP Part 6.7 — see
// Bundles.ts for why checkout doesn't charge the stated bundle price yet).
export function AddBundleToCart({ items }: { items: BundleItem[] }) {
  const { addItem, openCart } = useCart()
  const t = useTranslations('product')
  const [added, setAdded] = useState(false)

  const handleAdd = () => {
    for (const item of items) {
      addItem({ id: item.id, slug: item.slug, title: item.title, price: item.price, imageUrl: item.imageUrl }, item.quantity)
    }
    openCart()
    setAdded(true)
    setTimeout(() => setAdded(false), 1600)
  }

  return (
    <Button fullWidth onClick={handleAdd}>
      {added ? t('added') : t('addToCart')}
    </Button>
  )
}
