export type CartItem = {
  /** Unique cart line — `${id}|${size ?? ''}`. Same product in two sizes = two lines. */
  key: string
  id: string
  slug: string
  title: string
  price: number
  imageUrl?: string
  quantity: number
  /** Chosen size label — absent for unsized/one-of-a-kind pieces */
  size?: string
  /** Stock available when the item was added — UI clamp only; the server re-validates at order time */
  maxQuantity?: number
}

// Namespaced per brand so a second deployment doesn't collide on shared origins
// (e.g. localhost during dev). Set NEXT_PUBLIC_CART_KEY to override at build time.
const CART_KEY = process.env.NEXT_PUBLIC_CART_KEY || 'trackid-cart'

export function cartLineKey(id: string, size?: string): string {
  return `${id}|${size ?? ''}`
}

export function readCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CART_KEY)
    const items = raw ? (JSON.parse(raw) as CartItem[]) : []
    // Carts saved before line keys existed get them backfilled here
    return items.map((item) => ({ ...item, key: item.key ?? cartLineKey(item.id, item.size) }))
  } catch {
    return []
  }
}

export function writeCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CART_KEY, JSON.stringify(items))
}
