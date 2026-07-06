import { getPayload } from '@/lib/payload'
import { CART_COOKIE, CART_COOKIE_MAX_AGE, findCart, serializeCart, newSessionId } from '@/lib/cart-server'
import { getSizes } from '@/lib/stock'
import { NextRequest, NextResponse } from 'next/server'
import type { Payload } from 'payload'

const MAX_QTY = 99
const MAX_LINES = 30

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StoredItem = { product: number; size?: string; quantity: number }

async function currentOwner(payload: Payload, req: NextRequest) {
  const { user } = await payload.auth({ headers: req.headers })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerId = user && (user as any).collection === 'customers' ? (user as any).id : undefined
  const sessionId = req.cookies.get(CART_COOKIE)?.value
  return { customerId, sessionId }
}

export async function GET(req: NextRequest) {
  const payload = await getPayload()
  const { customerId, sessionId } = await currentOwner(payload, req)
  const locale = new URL(req.url).searchParams.get('locale') ?? undefined
  const cart = await findCart(payload, { customerId, sessionId })
  const { items, notices, kept } = await serializeCart(payload, cart, locale)
  await pruneDeadLines(payload, cart, kept)
  return NextResponse.json({ items, notices })
}

// Lines whose product was deleted/unpublished are dropped from serialization;
// prune them from the stored cart too so their `removed` notice shows once,
// not on every future read. Best-effort — a failed prune just repeats the notice.
async function pruneDeadLines(
  payload: Payload,
  cart: { id: string | number; items?: unknown[] } | null,
  kept: { product: number; size?: string; quantity: number }[],
) {
  if (!cart || (cart.items?.length ?? 0) === kept.length) return
  try {
    await payload.update({ collection: 'carts', id: cart.id, data: { items: kept } })
  } catch {
    // non-fatal
  }
}

export async function POST(req: NextRequest) {
  const payload = await getPayload()
  const { customerId } = await currentOwner(payload, req)
  let sessionId = req.cookies.get(CART_COOKIE)?.value

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const action = body.action as 'add' | 'update' | 'remove' | 'clear'
  const locale = typeof body.locale === 'string' ? body.locale : undefined

  let cart = await findCart(payload, { customerId, sessionId })
  let setCookie = false

  // Only 'add' creates a cart; other actions on a missing cart are no-ops
  if (!cart) {
    if (action !== 'add') return NextResponse.json({ items: [], notices: [] })
    if (customerId != null) {
      cart = (await payload.create({ collection: 'carts', data: { customer: customerId, items: [] } })) as {
        id: string | number
        items?: StoredItem[]
      }
    } else {
      if (!sessionId) {
        sessionId = newSessionId()
        setCookie = true
      }
      cart = (await payload.create({ collection: 'carts', data: { sessionId, items: [] } })) as {
        id: string | number
        items?: StoredItem[]
      }
    }
  }

  const items: StoredItem[] = Array.isArray(cart.items)
    ? cart.items.map((i) => ({
        product: Number(typeof i.product === 'object' && i.product ? (i.product as { id: number }).id : i.product),
        size: i.size || undefined,
        quantity: Number(i.quantity),
      }))
    : []

  if (action === 'clear') {
    await payload.update({ collection: 'carts', id: cart.id, data: { items: [] } })
    return finalize(payload, cart.id, locale, setCookie, sessionId)
  }

  const productId = Number(body.productId)
  const size = typeof body.size === 'string' && body.size ? body.size.slice(0, 40) : undefined
  if (!Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json({ error: 'Invalid product' }, { status: 400 })
  }

  if (action === 'add') {
    // Validate the product exists + is published; validate/normalize size; clamp to stock
    const product = await payload.findByID({ collection: 'products', id: productId, depth: 0 }).catch(() => null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!product || (product as any).status !== 'published') {
      return NextResponse.json({ error: 'This item is no longer available.' }, { status: 409 })
    }
    const sizes = getSizes(product)
    let stock: number
    let chosenSize: string | undefined
    if (sizes.length > 0) {
      const match = sizes.find((s) => s.label === size)
      if (!match) return NextResponse.json({ error: 'Please choose a valid size.' }, { status: 400 })
      chosenSize = match.label
      stock = match.stockQuantity
    } else {
      chosenSize = undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stock = typeof (product as any).stockQuantity === 'number' ? (product as any).stockQuantity : 0
    }
    const qty = Math.max(1, Math.min(MAX_QTY, Math.floor(Number(body.quantity) || 1)))
    const existing = items.find((i) => i.product === productId && (i.size || undefined) === chosenSize)
    if (existing) {
      existing.quantity = Math.min(existing.quantity + qty, stock || existing.quantity + qty)
    } else {
      if (items.length >= MAX_LINES) return NextResponse.json({ error: 'Cart is full.' }, { status: 409 })
      items.push({ product: productId, size: chosenSize, quantity: Math.min(qty, stock || qty) })
    }
  } else if (action === 'update') {
    const qty = Math.floor(Number(body.quantity))
    const idx = items.findIndex((i) => i.product === productId && (i.size || undefined) === size)
    if (idx >= 0) {
      if (qty < 1) items.splice(idx, 1)
      else items[idx].quantity = Math.min(qty, MAX_QTY)
    }
  } else if (action === 'remove') {
    const idx = items.findIndex((i) => i.product === productId && (i.size || undefined) === size)
    if (idx >= 0) items.splice(idx, 1)
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  await payload.update({ collection: 'carts', id: cart.id, data: { items } })
  return finalize(payload, cart.id, locale, setCookie, sessionId)
}

async function finalize(
  payload: Payload,
  cartId: string | number,
  locale: string | undefined,
  setCookie: boolean,
  sessionId: string | undefined,
) {
  const fresh = await findCartById(payload, cartId)
  const { items, notices, kept } = await serializeCart(payload, fresh, locale)
  await pruneDeadLines(payload, fresh, kept)
  const res = NextResponse.json({ items, notices })
  if (setCookie && sessionId) {
    res.cookies.set(CART_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: CART_COOKIE_MAX_AGE,
    })
  }
  return res
}

async function findCartById(payload: Payload, id: string | number) {
  try {
    return (await payload.findByID({ collection: 'carts', id, depth: 0 })) as { id: string | number; items?: StoredItem[] }
  } catch {
    return null
  }
}
