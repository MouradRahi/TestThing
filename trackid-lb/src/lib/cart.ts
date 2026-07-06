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
 * A change the server detected while resolving the cart against the live
 * catalog — surfaced as a banner so lines never vanish or block silently.
 */
export type CartNotice =
  /** Product was unpublished/deleted — its line was dropped from the cart */
  | { type: 'removed'; title?: string; size?: string }
  /** Line is still in the cart but the piece (or chosen size) has no stock left */
  | { type: 'sold_out'; title: string; size?: string }
  /** Requested quantity exceeds what's in stock now */
  | { type: 'reduced'; title: string; size?: string; available: number }
