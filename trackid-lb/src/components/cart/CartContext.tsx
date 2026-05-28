'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { CartItem } from '@/lib/cart'
import { readCart, writeCart } from '@/lib/cart'

type CartContextValue = {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, qty: number) => void
  clearCart: () => void
  itemCount: number
  total: number
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    setItems(readCart())
  }, [])

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id)
      const next = existing
        ? prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...prev, { ...item, quantity: 1 }]
      writeCart(next)
      return next
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.id !== id)
      writeCart(next)
      return next
    })
  }, [])

  const updateQuantity = useCallback((id: string, qty: number) => {
    if (qty < 1) return
    setItems(prev => {
      const next = prev.map(i => i.id === id ? { ...i, quantity: qty } : i)
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
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, itemCount, total }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
