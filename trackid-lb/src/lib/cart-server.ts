import type { Payload } from 'payload'
import type { CartItem } from './cart'
import { cartLineKey } from './cart'
import { getSizes, totalStock } from './stock'

export const CART_COOKIE = 'cart-session'
export const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 60 // 60 days

type StoredItem = { product: number | { id: number | string }; size?: string | null; quantity: number }
export type CartDoc = { id: string | number; items?: StoredItem[] } | null

const pidOf = (product: StoredItem['product']): number =>
  Number(typeof product === 'object' && product ? product.id : product)

export function newSessionId(): string {
  return crypto.randomUUID()
}

export async function findCart(
  payload: Payload,
  by: { customerId?: string | number; sessionId?: string },
): Promise<CartDoc> {
  if (by.customerId != null) {
    const { docs } = await payload.find({
      collection: 'carts',
      where: { customer: { equals: by.customerId } },
      limit: 1,
      depth: 0,
    })
    return (docs[0] as CartDoc) ?? null
  }
  if (by.sessionId) {
    const { docs } = await payload.find({
      collection: 'carts',
      where: { sessionId: { equals: by.sessionId } },
      limit: 1,
      depth: 0,
    })
    return (docs[0] as CartDoc) ?? null
  }
  return null
}

/**
 * Resolve stored cart items into full display lines, re-reading each product
 * from the DB — so prices, titles, images, and stock are always current (fixes
 * the stale-price problem the old localStorage cart had). Products that no
 * longer exist or are unpublished are dropped.
 */
export async function serializeCart(
  payload: Payload,
  cart: CartDoc,
  locale?: string,
): Promise<CartItem[]> {
  const items = cart?.items ?? []
  if (!items.length) return []

  const productIds = [...new Set(items.map((i) => pidOf(i.product)))].filter((n) => Number.isInteger(n))
  if (!productIds.length) return []

  const { docs: products } = await payload.find({
    collection: 'products',
    where: { id: { in: productIds }, status: { equals: 'published' } },
    limit: 100,
    depth: 1,
    ...(locale ? { locale: locale as 'en' | 'ar' } : {}),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = new Map(products.map((p: any) => [Number(p.id), p]))

  const lines: CartItem[] = []
  for (const it of items) {
    const pid = pidOf(it.product)
    const p = byId.get(pid)
    if (!p) continue
    const size = it.size || undefined
    const sizes = getSizes(p)
    const maxQuantity = size
      ? (sizes.find((s: { label: string }) => s.label === size)?.stockQuantity ?? 0)
      : totalStock(p)
    const images = Array.isArray(p.images) ? p.images : []
    lines.push({
      key: cartLineKey(String(pid), size),
      id: String(pid),
      slug: p.slug,
      title: p.title,
      price: p.price,
      imageUrl: images[0]?.url ?? undefined,
      size,
      quantity: it.quantity,
      maxQuantity,
    })
  }
  return lines
}

// Combine two stored-item lists, summing quantities per product+size.
export function mergeItems(a: StoredItem[] = [], b: StoredItem[] = []): StoredItem[] {
  const map = new Map<string, StoredItem>()
  for (const list of [a, b]) {
    for (const it of list) {
      const pid = pidOf(it.product)
      const size = it.size || undefined
      const key = `${pid}|${size ?? ''}`
      const existing = map.get(key)
      if (existing) existing.quantity += it.quantity
      else map.set(key, { product: pid, size, quantity: it.quantity })
    }
  }
  return [...map.values()]
}

/**
 * On login/register, fold the guest cart (by session cookie) into the
 * customer's cart. Reuses the guest cart row when the customer has none.
 */
export async function mergeGuestCart(
  payload: Payload,
  sessionId: string | undefined,
  customerId: string | number,
): Promise<void> {
  if (!sessionId) return
  try {
    const guest = await findCart(payload, { sessionId })
    if (!guest) return
    const customerCart = await findCart(payload, { customerId })

    if (!customerCart) {
      // Claim the guest cart for the account
      await payload.update({
        collection: 'carts',
        id: guest.id,
        data: { customer: customerId, sessionId: null, items: guest.items ?? [] },
      })
      return
    }

    await payload.update({
      collection: 'carts',
      id: customerCart.id,
      data: { items: mergeItems(customerCart.items, guest.items) },
    })
    await payload.delete({ collection: 'carts', id: guest.id })
  } catch {
    // Merge is best-effort — never block login on it
  }
}
