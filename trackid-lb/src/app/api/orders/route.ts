import { getPayload } from '@/lib/payload'
import { sendOrderConfirmationEmail, sendOrderWhatsAppAlert } from '@/lib/notifications'
import { rateLimit, clientIp, cleanString, cleanOptional, isValidPhone, EMAIL_RE } from '@/lib/api-guards'
import { resolveDeliveryFee, getDeliveryZones, resolveBrandCopy } from '@/lib/site-settings'
import { resolveDiscount } from '@/lib/discounts'
import { getSizes } from '@/lib/stock'
import { safeRevalidatePath } from '@/lib/revalidate'
import { NextRequest, NextResponse, after } from 'next/server'
import type { Payload } from 'payload'

const MAX_DISTINCT_ITEMS = 30
const MAX_QUANTITY_PER_ITEM = 99

function generateOrderNumber(prefix?: unknown): string {
  // 6-digit ms timestamp tail + 4 random alphanumeric chars — no module state,
  // collision-safe across cold starts and concurrent Vercel instances
  const safePrefix =
    (typeof prefix === 'string' ? prefix.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '') || 'TRK'
  const ts = Date.now().toString().slice(-6)
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${safePrefix}-${ts}-${rand}`
}

// ── Stock ────────────────────────────────────────────────────────────────────

type PgPool = { query: (sql: string, params: unknown[]) => Promise<{ rowCount: number | null }> }

function getPool(payload: Payload): PgPool | null {
  const pool = (payload.db as unknown as { pool?: PgPool }).pool
  return pool && typeof pool.query === 'function' ? pool : null
}

type StockLine = { productId: number; quantity: number; size?: string }

/**
 * Conditional decrement: only succeeds when enough stock exists, atomically.
 * Two concurrent orders for the last one-of-a-kind piece cannot both pass.
 * Sized products decrement the matching row in the products_sizes array table.
 */
async function decrementStock(payload: Payload, line: StockLine): Promise<boolean> {
  const pool = getPool(payload)
  if (pool) {
    try {
      const res = line.size
        ? await pool.query(
            'UPDATE products_sizes SET stock_quantity = stock_quantity - $1 WHERE _parent_id = $2 AND label = $3 AND stock_quantity >= $1',
            [line.quantity, line.productId, line.size],
          )
        : await pool.query(
            'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND stock_quantity >= $1',
            [line.quantity, line.productId],
          )
      return (res.rowCount ?? 0) > 0
    } catch (err) {
      console.error('[orders] Atomic decrement failed, falling back to read-modify-write:', err)
    }
  }
  // Fallback without direct pool access — the min:0 field validation still
  // prevents stock from going negative, just not atomically.
  const product = await payload.findByID({ collection: 'products', id: line.productId, depth: 0 })
  if (line.size) {
    const sizes = Array.isArray(product.sizes) ? [...product.sizes] : []
    const idx = sizes.findIndex((s: { label?: string }) => s?.label === line.size)
    if (idx < 0 || (sizes[idx].stockQuantity ?? 0) < line.quantity) return false
    sizes[idx] = { ...sizes[idx], stockQuantity: sizes[idx].stockQuantity - line.quantity }
    await payload.update({ collection: 'products', id: line.productId, data: { sizes } })
    return true
  }
  const current = typeof product.stockQuantity === 'number' ? product.stockQuantity : 0
  if (current < line.quantity) return false
  await payload.update({
    collection: 'products',
    id: line.productId,
    data: { stockQuantity: current - line.quantity },
  })
  return true
}

async function restoreStock(payload: Payload, lines: StockLine[]): Promise<void> {
  for (const line of lines) {
    try {
      const pool = getPool(payload)
      if (pool) {
        if (line.size) {
          await pool.query(
            'UPDATE products_sizes SET stock_quantity = stock_quantity + $1 WHERE _parent_id = $2 AND label = $3',
            [line.quantity, line.productId, line.size],
          )
        } else {
          await pool.query('UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2', [
            line.quantity,
            line.productId,
          ])
        }
        continue
      }
      const product = await payload.findByID({ collection: 'products', id: line.productId, depth: 0 })
      if (line.size) {
        const sizes = Array.isArray(product.sizes) ? [...product.sizes] : []
        const idx = sizes.findIndex((s: { label?: string }) => s?.label === line.size)
        if (idx < 0) continue
        sizes[idx] = { ...sizes[idx], stockQuantity: (sizes[idx].stockQuantity ?? 0) + line.quantity }
        await payload.update({ collection: 'products', id: line.productId, data: { sizes } })
      } else {
        const current = typeof product.stockQuantity === 'number' ? product.stockQuantity : 0
        await payload.update({
          collection: 'products',
          id: line.productId,
          data: { stockQuantity: current + line.quantity },
        })
      }
    } catch (err) {
      console.error(`[orders] Failed to restore stock for product ${line.productId}:`, err)
    }
  }
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`orders:${clientIp(req)}`, 5, 10 * 60_000)) {
      return NextResponse.json(
        { error: 'Too many orders from this connection. Please wait a few minutes and try again.' },
        { status: 429 },
      )
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Honeypot — real users never see this field. Pretend success so bots move on.
    if (body.website) {
      return NextResponse.json({ orderId: 0, orderNumber: generateOrderNumber() }, { status: 201 })
    }

    const customerName = cleanString(body.customerName, 120)
    const customerPhone = cleanString(body.customerPhone, 40)
    const deliveryAddress = cleanString(body.deliveryAddress, 500)
    const area = cleanString(body.area, 120)
    const customerEmail = cleanOptional(body.customerEmail, 160)
    const notes = cleanOptional(body.notes, 1000)
    const discountCodeInput = cleanOptional(body.discountCode, 40)
    const paymentMethod: 'cod' | 'bank_transfer' =
      body.paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'cod'

    // Per-field validation — `fields` maps field name → 'required' | 'invalid'
    // so the checkout form can highlight exactly what to fix (localized client-side).
    const fieldErrors: Record<string, 'required' | 'invalid'> = {}
    if (!customerName) fieldErrors.customerName = 'required'
    if (!customerPhone) fieldErrors.customerPhone = 'required'
    if (!deliveryAddress) fieldErrors.deliveryAddress = 'required'
    if (!area) fieldErrors.area = 'required'
    if (customerEmail === null) fieldErrors.customerEmail = 'invalid'
    if (notes === null) fieldErrors.notes = 'invalid'
    if (discountCodeInput === null) fieldErrors.discountCode = 'invalid'

    if (customerPhone && !fieldErrors.customerPhone) {
      const phoneDigits = customerPhone.replace(/[\s()-]/g, '')
      if (!/^\+?\d{7,15}$/.test(phoneDigits)) fieldErrors.customerPhone = 'invalid'
    }

<<<<<<< HEAD
    // Compound condition doubles as the TS narrowing guard (string | null → string)
    if (
      !customerName || !customerPhone || !deliveryAddress || !area ||
      customerEmail === null || notes === null || discountCodeInput === null ||
      Object.keys(fieldErrors).length > 0
    ) {
      return NextResponse.json(
        { error: 'Missing or invalid fields', fields: fieldErrors },
        { status: 400 },
      )
=======
    if (!isValidPhone(customerPhone)) {
      return NextResponse.json({ error: 'Please enter a valid phone number.' }, { status: 400 })
>>>>>>> 5d6610bce63ba80a5e9557a74bf8f9061cc35328
    }

    // Optional, but when present it must be deliverable — a typo'd email means
    // the confirmation silently never arrives.
    if (customerEmail && !EMAIL_RE.test(customerEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }

    const rawItems = Array.isArray(body.items) ? body.items : []
    if (rawItems.length === 0 || rawItems.length > MAX_DISTINCT_ITEMS) {
      return NextResponse.json({ error: 'Invalid items' }, { status: 400 })
    }

    // The client sends only { productId, quantity, size? } — duplicates merged here.
    // A line is product + size; the same product in two sizes is two lines.
    const qtyByLine = new Map<string, { productId: number; size?: string; quantity: number }>()
    for (const raw of rawItems) {
      const productId = Number(raw?.productId)
      const quantity = Number(raw?.quantity)
      const size = cleanOptional(raw?.size, 40)
      if (
        !Number.isInteger(productId) || productId <= 0 ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_ITEM ||
        size === null
      ) {
        return NextResponse.json({ error: 'Invalid items' }, { status: 400 })
      }
      const key = `${productId}|${size ?? ''}`
      const existing = qtyByLine.get(key)
      qtyByLine.set(key, { productId, size, quantity: (existing?.quantity ?? 0) + quantity })
    }

    const payload = await getPayload()

    // Prices, titles, and images come from the database — never from the client.
    const productIds = [...new Set([...qtyByLine.values()].map((l) => l.productId))]
    const { docs: products } = await payload.find({
      collection: 'products',
      where: {
        id: { in: productIds },
        status: { equals: 'published' },
      },
      limit: MAX_DISTINCT_ITEMS,
      depth: 0,
    })

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: 'Some items in your cart are no longer available. Please review your cart.' },
        { status: 409 },
      )
    }

    const productById = new Map(products.map((p) => [Number(p.id), p]))

    // Validate sizes against the catalog before touching stock or money.
    for (const line of qtyByLine.values()) {
      const product = productById.get(line.productId)!
      const sizes = getSizes(product)
      if (sizes.length > 0) {
        if (!line.size || !sizes.some((s) => s.label === line.size)) {
          return NextResponse.json(
            { error: `Please pick a size for "${product.title}".` },
            { status: 400 },
          )
        }
      } else {
        line.size = undefined // unsized product — ignore any stray size value
      }
    }

    const items = [...qtyByLine.values()].map((line) => {
      const product = productById.get(line.productId)!
      const images = Array.isArray(product.images) ? product.images : []
      return {
        productId: String(product.id),
        titleAtPurchase: product.title,
        size: line.size,
        priceAtPurchase: product.price,
        quantity: line.quantity,
        imageUrl: images[0]?.url ?? undefined,
      }
    })
    const subtotal = items.reduce((sum, item) => sum + item.priceAtPurchase * item.quantity, 0)

    // Delivery fee comes from the configured zones, never from the client.
    // Validate before touching stock so invalid submissions fail cleanly.
    let settings: Record<string, unknown> = {}
    try {
      settings = (await payload.findGlobal({ slug: 'site-settings' })) as unknown as Record<string, unknown>
    } catch {
      // fresh install without the global — free-text area mode, fee 0
    }
    const deliveryFee = resolveDeliveryFee(settings, area, subtotal)
    if (deliveryFee === null) {
      return NextResponse.json(
        { error: 'Please select a valid delivery area.', fields: { area: 'invalid' } },
        { status: 400 },
      )
    }

    // Discount is recomputed here from the DB — the client code is only a request.
    // A now-invalid code blocks checkout (before any stock is touched) with a clear message.
    let discountCode: string | undefined
    let discountAmount = 0
    let discountId: string | number | undefined
    if (discountCodeInput) {
      const result = await resolveDiscount(payload, discountCodeInput, subtotal)
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      discountCode = result.code
      discountAmount = result.amount
      discountId = result.id
    }

    const total = Math.max(0, subtotal - discountAmount) + deliveryFee

    // Link the order to the logged-in customer account, if any (guest orders have none)
    let customerId: number | undefined
    try {
      const { user } = await payload.auth({ headers: req.headers })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (user && (user as any).collection === 'customers') customerId = Number(user.id)
    } catch {
      // not signed in — guest order
    }

    const decremented: StockLine[] = []
    for (const line of qtyByLine.values()) {
      const product = productById.get(line.productId)!
      if (!(await decrementStock(payload, line))) {
        await restoreStock(payload, decremented)
        const label = line.size ? `"${product.title}" in size ${line.size}` : `"${product.title}"`
        return NextResponse.json(
          { error: `${label} is no longer available in the requested quantity. Please update your cart.` },
          { status: 409 },
        )
      }
      decremented.push({ productId: line.productId, quantity: line.quantity, size: line.size })
    }

    let order
    try {
      order = await payload.create({
        collection: 'orders',
        data: {
          orderNumber: generateOrderNumber(settings.orderNumberPrefix),
          customerName,
          customerPhone,
          customerEmail,
          ...(customerId ? { customer: Number(customerId) } : {}),
          deliveryAddress,
          area,
          items,
          subtotal,
          deliveryFee,
          discountCode,
          discountAmount,
          total,
          paymentMethod,
          paymentStatus: 'pending',
          orderStatus: 'pending',
          notes,
        },
      })
    } catch (err) {
      await restoreStock(payload, decremented)
      throw err
    }

    // Record the redemption (non-fatal — never fail a placed order over this)
    if (discountId != null) {
      try {
        const pool = getPool(payload)
        if (pool) {
          await pool.query('UPDATE discounts SET usage_count = usage_count + 1 WHERE id = $1', [discountId])
        } else {
          const current = await payload.findByID({ collection: 'discounts', id: discountId, depth: 0 })
          await payload.update({
            collection: 'discounts',
            id: discountId,
            data: { usageCount: (Number(current.usageCount) || 0) + 1 },
          })
        }
      } catch (err) {
        console.error('[orders] Failed to increment discount usage:', err)
      }
    }

    // Stock changed via raw SQL (bypasses Payload hooks) — refresh the cached pages
    safeRevalidatePath('/shop')
    safeRevalidatePath('/')
    for (const product of products) {
      if (product.slug) safeRevalidatePath(`/product/${product.slug}`)
    }

    const zonesConfigured = getDeliveryZones(settings).length > 0
    const notificationData = {
      orderId: String(order.id),
      orderNumber: order.orderNumber as string,
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      area,
      items,
      subtotal,
      discountCode,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      total,
      paymentMethod,
      deliveryFeeLabel: zonesConfigured
        ? deliveryFee === 0
          ? 'Free'
          : `$${deliveryFee.toFixed(2)}`
        : undefined,
      bankInstructions:
        paymentMethod === 'bank_transfer' && typeof settings.bankTransferInstructions === 'string'
          ? settings.bankTransferInstructions
          : undefined,
      brand: resolveBrandCopy(settings),
    }

    // after() keeps the serverless function alive past the response —
    // a plain void'd promise can be frozen before it completes on Vercel.
    after(() =>
      Promise.allSettled([
        sendOrderConfirmationEmail(notificationData),
        sendOrderWhatsAppAlert(notificationData),
      ]),
    )

    return NextResponse.json({ orderId: order.id, orderNumber: order.orderNumber }, { status: 201 })
  } catch (err) {
    console.error('Order creation failed:', err)
    return NextResponse.json({ error: 'Order creation failed' }, { status: 500 })
  }
}
