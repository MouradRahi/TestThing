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
