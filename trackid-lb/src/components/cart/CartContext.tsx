'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useLocale } from 'next-intl'
import type { CartItem, CartNotice } from '@/lib/cart'
import { cartLineKey } from '@/lib/cart'

type CartContextValue = {
  items: CartItem[]
  /** False until the first server-cart fetch resolves — render skeletons, not "empty". */
  isLoading: boolean
  addItem: (item: Omit<CartItem, 'quantity' | 'key'>, quantity?: number) => void
  removeItem: (key: string) => void
  updateQuantity: (key: string, qty: number) => void
  clearCart: () => void
  /** Re-fetch the server cart (e.g. after login merges the guest cart). */
  refreshCart: () => void
  /** Catalog changes the server detected (line removed / sold out / stock reduced). */
  notices: CartNotice[]
  dismissNotices: () => void
  itemCount: number
  total: number
  /** CMS-driven copy shown on the empty cart page (SiteSettings → Copy). */
  emptyCartMessage: string
  /** Slide-over mini-cart open state. */
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

// key = `${productId}|${size ?? ''}` → recover the parts for API calls
function parseKey(key: string): { productId: string; size?: string } {
  const i = key.indexOf('|')
  if (i < 0) return { productId: key }
  const size = key.slice(i + 1)
  return { productId: key.slice(0, i), size: size || undefined }
}

export function CartProvider({
  children,
  emptyCartMessage = 'Find a piece that speaks to you.',
}: {
  children: React.ReactNode
  emptyCartMessage?: string
}) {
  const locale = useLocale()
  const [items, setItems] = useState<CartItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [notices, setNotices] = useState<CartNotice[]>([])
  const [isOpen, setIsOpen] = useState(false)

  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])
  const dismissNotices = useCallback(() => setNotices([]), [])

  const refreshCart = useCallback(() => {
    fetch(`/api/cart?locale=${locale}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.items)) setItems(d.items)
        if (Array.isArray(d?.notices)) setNotices(d.notices)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [locale])

  // Load the server cart after mount (and when locale changes → re-localized titles)
  useEffect(() => {
    refreshCart()
  }, [refreshCart])

  // Rapid clicks (e.g. holding +) fire multiple mutations whose responses can
  // arrive out of order over the network. Every response is a full snapshot
  // of the cart, so it's enough to track *which mutation was issued last* and
  // only ever apply the response matching it — a stale response (an earlier
  // click's request resolving after a later one) is simply discarded rather
  // than momentarily flashing an out-of-date quantity.
  const latestRequestId = useRef(0)

  // Fire a mutation and reconcile with the server's authoritative cart
  const mutate = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (body: Record<string, any>) => {
      const requestId = ++latestRequestId.current
      try {
        const res = await fetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, locale }),
        })
        const d = await res.json().catch(() => null)
        if (requestId !== latestRequestId.current) return // superseded by a newer mutation — stale, ignore
        if (res.ok) {
          if (Array.isArray(d?.items)) setItems(d.items)
          if (Array.isArray(d?.notices)) setNotices(d.notices)
        } else {
          // Rejected (sold out, invalid size, …) — undo the optimistic update by
          // re-fetching the authoritative cart, and tell the customer why.
          if (typeof d?.error === 'string' && d.error) {
            setNotices((prev) => [...prev, { type: 'error', message: d.error }])
          }
          refreshCart()
        }
      } catch {
        // network error — leave the optimistic state; next refresh reconciles
      }
    },
    [locale, refreshCart],
  )

  const addItem = useCallback(
    (item: Omit<CartItem, 'quantity' | 'key'>, quantity = 1) => {
      const key = cartLineKey(item.id, item.size)
      setItems((prev) => {
        const existing = prev.find((i) => i.key === key)
        const max = item.maxQuantity ?? existing?.maxQuantity ?? Infinity
        return existing
          ? prev.map((i) =>
              i.key === key
                ? { ...i, quantity: Math.min(i.quantity + quantity, max), maxQuantity: item.maxQuantity ?? i.maxQuantity }
                : i,
            )
          : [...prev, { ...item, key, quantity: Math.min(quantity, max) }]
      })
      void mutate({ action: 'add', productId: item.id, size: item.size, quantity })
    },
    [mutate],
  )

  const updateQuantity = useCallback(
    (key: string, qty: number) => {
      if (qty < 1) return
      setItems((prev) => prev.map((i) => (i.key === key ? { ...i, quantity: Math.min(qty, i.maxQuantity ?? Infinity) } : i)))
      const { productId, size } = parseKey(key)
      void mutate({ action: 'update', productId, size, quantity: qty })
    },
    [mutate],
  )

  const removeItem = useCallback(
    (key: string) => {
      setItems((prev) => prev.filter((i) => i.key !== key))
      const { productId, size } = parseKey(key)
      void mutate({ action: 'remove', productId, size })
    },
    [mutate],
  )

  const clearCart = useCallback(() => {
    setItems([])
    void mutate({ action: 'clear' })
  }, [mutate])

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <CartContext.Provider
      value={{ items, isLoading, addItem, removeItem, updateQuantity, clearCart, refreshCart, notices, dismissNotices, itemCount, total, emptyCartMessage, isOpen, openCart, closeCart }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
