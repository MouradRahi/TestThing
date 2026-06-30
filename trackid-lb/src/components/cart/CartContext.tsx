'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { CartItem } from '@/lib/cart'
import { readCart, writeCart, cartLineKey } from '@/lib/cart'

type CartContextValue = {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity' | 'key'>, quantity?: number) => void
  removeItem: (key: string) => void
  updateQuantity: (key: string, qty: number) => void
  clearCart: () => void
  itemCount: number
  total: number
  /** CMS-driven copy shown on the empty cart page (SiteSettings → Copy). */
  emptyCartMessage: string
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({
  children,
  emptyCartMessage = 'Find a piece that speaks to you.',
}: {
  children: React.ReactNode
  emptyCartMessage?: string
}) {
  const [items, setItems] = useState<CartItem[]>([])

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    setItems(readCart())
  }, [])

  const addItem = useCallback((item: Omit<CartItem, 'quantity' | 'key'>, quantity = 1) => {
    const key = cartLineKey(item.id, item.size)
    setItems(prev => {
      const existing = prev.find(i => i.key === key)
      const max = item.maxQuantity ?? existing?.maxQuantity ?? Infinity
      const next = existing
        ? prev.map(i => i.key === key
            ? { ...i, quantity: Math.min(i.quantity + quantity, max), maxQuantity: item.maxQuantity ?? i.maxQuantity }
            : i)
        : [...prev, { ...item, key, quantity: Math.min(quantity, max) }]
      writeCart(next)
      return next
    })
  }, [])

  const removeItem = useCallback((key: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.key !== key)
      writeCart(next)
      return next
    })
  }, [])

  const updateQuantity = useCallback((key: string, qty: number) => {
    if (qty < 1) return
    setItems(prev => {
      const next = prev.map(i =>
        i.key === key ? { ...i, quantity: Math.min(qty, i.maxQuantity ?? Infinity) } : i)
      writeCart(next)
      return next
    })
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    writeCart([])
  }, [])

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, itemCount, total, emptyCartMessage }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
