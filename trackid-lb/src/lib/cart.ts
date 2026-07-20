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
  /** Current available stock — UI clamp only; the server re-validates at order time */
  maxQuantity?: number
}

export function cartLineKey(id: string, size?: string): string {
  return `${id}|${size ?? ''}`
}

/**
 * The server re-resolves stock on every cart read, so a line whose quantity
 * exceeds current availability means the piece sold (or partially sold) since
 * it was added. Checkout would 409 — surface it before the customer gets there.
 */
export function hasStockConflict(item: CartItem): boolean {
  return item.maxQuantity != null && item.quantity > item.maxQuantity
}

export function cartHasStockConflicts(items: CartItem[]): boolean {
  return items.some(hasStockConflict)
}
