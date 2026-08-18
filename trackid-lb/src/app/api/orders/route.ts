import { getPayload } from '@/lib/payload'
import { sendOrderConfirmationEmail, sendOrderWhatsAppAlert } from '@/lib/notifications'
import { clientIp, cleanString, cleanOptional, isValidPhone, EMAIL_RE } from '@/lib/api-guards'
import { durableRateLimit } from '@/lib/durable-rate-limit'
import { getIdempotentResponse, saveIdempotentResponse } from '@/lib/idempotency'
import { resolveDeliveryFee, getDeliveryZones, resolveBrandCopy, resolveCurrencyDisplay, resolveVatConfig } from '@/lib/site-settings'
import { generateInvoicePdf } from '@/lib/invoices/invoice-pdf'
import { resolveDiscount, redeemDiscount, releaseDiscount } from '@/lib/discounts'
import { resolveGiftCard, redeemGiftCardAmount, releaseGiftCardAmount } from '@/lib/gift-cards'
import { redeemStoreCredit, releaseStoreCredit } from '@/lib/store-credit'
import { resolveLoyaltyConfig, redeemPoints, releasePoints } from '@/lib/loyalty'
import { reportServerError } from '@/lib/error-reporting'
import { getSizes } from '@/lib/stock'
import { safeRevalidatePath } from '@/lib/revalidate'
import { getPool } from '@/lib/db-pool'
import { initiatePayment, paymentExpiryDate, PAYMENT_EXPIRY_MINUTES, OMT_RESERVATION_HOURS } from '@/lib/payments/service'
import { isProviderAvailable } from '@/lib/payments/registry'
import type { PaymentInitiateResult } from '@/lib/payments/types'
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
    const payload = await getPayload() // cheap — memoized singleton, see lib/payload.ts

    if (!(await durableRateLimit(payload, `orders:${clientIp(req)}`, 5, 10 * 60_000))) {
      return NextResponse.json(
        { error: 'Too many orders from this connection. Please wait a few minutes and try again.' },
        { status: 429 },
      )
    }

    // A client-generated key sent on retry (network timeout, double-tap
    // before the button disables) — return the original response instead of
    // creating a second order. No key = no idempotency (older clients, or
    // callers that don't send one) — behaves exactly as before.
    const idempotencyKey = req.headers.get('idempotency-key')?.trim().slice(0, 100) || null
    if (idempotencyKey) {
      const cached = await getIdempotentResponse(payload, idempotencyKey)
      if (cached) return NextResponse.json(cached.body, { status: cached.status })
    }

    // Campaign attribution (ROADMAP Part 7) — first-touch cookie set by
    // middleware.ts, snapshotted onto the order at creation. Malformed/absent
    // cookie is not an error — attribution is a nice-to-have, never blocks checkout.
    let utmSource: string | undefined
    let utmMedium: string | undefined
    let utmCampaign: string | undefined
    try {
      const raw = req.cookies.get('utm_data')?.value
      if (raw) {
        const parsed = JSON.parse(raw)
        utmSource = typeof parsed.utm_source === 'string' ? parsed.utm_source.slice(0, 100) : undefined
        utmMedium = typeof parsed.utm_medium === 'string' ? parsed.utm_medium.slice(0, 100) : undefined
        utmCampaign = typeof parsed.utm_campaign === 'string' ? parsed.utm_campaign.slice(0, 100) : undefined
      }
    } catch {
      // malformed cookie — ignore, no attribution recorded for this order
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
    const giftCardCodeInput = cleanOptional(body.giftCardCode, 40)
    const useStoreCredit = body.useStoreCredit === true
    const usePoints = body.usePoints === true
    const paymentMethod: 'cod' | 'bank_transfer' | 'card' | 'omt' =
      body.paymentMethod === 'bank_transfer'
        ? 'bank_transfer'
        : body.paymentMethod === 'card'
          ? 'card'
          : body.paymentMethod === 'omt'
            ? 'omt'
            : 'cod'
    // Both go through the same "reserve stock, open a provider session,
    // await a confirmation event" flow — card via hosted-checkout redirect,
    // OMT via a pay-at-branch voucher (ROADMAP F2 §2.4).
    const needsPaymentSession = paymentMethod === 'card' || paymentMethod === 'omt'

    if (
      !customerName || !customerPhone || !deliveryAddress || !area ||
      customerEmail === null || notes === null || discountCodeInput === null || giftCardCodeInput === null
    ) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    if (!isValidPhone(customerPhone)) {
      return NextResponse.json({ error: 'Please enter a valid phone number.' }, { status: 400 })
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

    // Each online payment method must be explicitly enabled AND its provider
    // must actually be usable (env/config permitting) — never silently fall
    // back to a different payment method the customer didn't pick.
    const cardProviderKey =
      typeof settings.cardPaymentProvider === 'string' ? settings.cardPaymentProvider : 'mock'
    if (paymentMethod === 'card' && (!settings.cardPaymentsEnabled || !isProviderAvailable(cardProviderKey))) {
      return NextResponse.json(
        { error: 'Card payments aren’t available right now. Please choose another payment method.' },
        { status: 400 },
      )
    }
    if (paymentMethod === 'omt' && (!settings.omtPaymentEnabled || !isProviderAvailable('omt'))) {
      return NextResponse.json(
        { error: 'OMT payments aren’t available right now. Please choose another payment method.' },
        { status: 400 },
      )
    }
    const paymentProviderKey = paymentMethod === 'card' ? cardProviderKey : 'omt'

    const deliveryFee = resolveDeliveryFee(settings, area, subtotal)
    if (deliveryFee === null) {
      return NextResponse.json({ error: 'Please select a valid delivery area.' }, { status: 400 })
    }

    // Link the order to the logged-in customer account, if any (guest orders
    // have none — moved ahead of the credits block below since gift
    // cards/store credit/points all need to know who's checking out).
    let customerId: number | undefined
    try {
      const { user } = await payload.auth({ headers: req.headers })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (user && (user as any).collection === 'customers') customerId = Number(user.id)
    } catch {
      // not signed in — guest order
    }

    // Discount is recomputed here from the DB — the client code is only a request.
    // A now-invalid code blocks checkout (before any stock is touched) with a clear message.
    // The redemption itself is claimed atomically right here (before stock, so a
    // usage-limit rejection never needs a stock rollback) — resolveDiscount's check
    // above is a read, not a guarantee; two concurrent checkouts for a code's last
    // use could otherwise both pass it and both place an order (rolled back below
    // via releaseDiscount if a later step in this request fails).
    let discountCode: string | undefined
    let discountAmount = 0
    let discountId: string | number | undefined
    let discountRedeemed = false
    if (discountCodeInput) {
      const result = await resolveDiscount(payload, discountCodeInput, subtotal)
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      discountCode = result.code
      discountAmount = result.amount
      discountId = result.id
      if (!(await redeemDiscount(payload, discountId))) {
        return NextResponse.json({ error: 'This code has reached its usage limit.' }, { status: 400 })
      }
      discountRedeemed = true
    }

    // Gift card / store credit / loyalty points (ROADMAP Part 6.3/6.6) — same
    // "resolve, then claim atomically before stock is touched, roll back on
    // any later failure" shape as the discount block above. Applied in this
    // order against whatever's left after the discount: gift card, then
    // store credit, then points — each only ever eats into the remaining
    // balance, never goes negative, never exceeds what's actually available.
    const amountAfterDiscount = Math.max(0, subtotal - discountAmount)
    let remainingForCredits = amountAfterDiscount
    let giftCardCode: string | undefined
    let giftCardId: string | number | undefined
    let giftCardAmount = 0
    let giftCardRedeemed = false
    let storeCreditApplied = 0
    let storeCreditRedeemed = false
    let pointsRedeemedCount = 0
    let pointsAmount = 0
    let pointsRedeemedFlag = false

    if (giftCardCodeInput) {
      if (discountAmount > 0 && settings.giftCardsCombinableWithDiscounts === false) {
        if (discountRedeemed && discountId != null) await releaseDiscount(payload, discountId)
        return NextResponse.json({ error: 'This gift card can’t be combined with a discount code.' }, { status: 400 })
      }
      const result = await resolveGiftCard(payload, giftCardCodeInput)
      if (!result.ok) {
        if (discountRedeemed && discountId != null) await releaseDiscount(payload, discountId)
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      giftCardCode = giftCardCodeInput.trim().toUpperCase().replace(/\s+/g, '')
      giftCardId = result.id
      giftCardAmount = Math.round(Math.min(result.remainingBalance, remainingForCredits) * 100) / 100
      if (giftCardAmount > 0) {
        if (!(await redeemGiftCardAmount(payload, giftCardId, giftCardAmount))) {
          if (discountRedeemed && discountId != null) await releaseDiscount(payload, discountId)
          return NextResponse.json({ error: 'This gift card’s balance changed — please try again.' }, { status: 400 })
        }
        giftCardRedeemed = true
        remainingForCredits = Math.round((remainingForCredits - giftCardAmount) * 100) / 100
      }
    }

    if (useStoreCredit && customerId != null && remainingForCredits > 0) {
      const customerDoc = await payload.findByID({ collection: 'customers', id: customerId, depth: 0 }).catch(() => null)
      const available = customerDoc ? Number(customerDoc.storeCredit) || 0 : 0
      storeCreditApplied = Math.round(Math.min(available, remainingForCredits) * 100) / 100
      if (storeCreditApplied > 0) {
        if (await redeemStoreCredit(payload, customerId, storeCreditApplied)) {
          storeCreditRedeemed = true
          remainingForCredits = Math.round((remainingForCredits - storeCreditApplied) * 100) / 100
        } else {
          storeCreditApplied = 0 // balance changed underneath us — skip silently, not worth failing checkout over
        }
      }
    }

    const loyalty = resolveLoyaltyConfig(settings)
    if (usePoints && loyalty.enabled && customerId != null && remainingForCredits > 0) {
      const customerDoc = await payload.findByID({ collection: 'customers', id: customerId, depth: 0 }).catch(() => null)
      const availablePoints = customerDoc ? Number(customerDoc.loyaltyPoints) || 0 : 0
      const maxDollarsFromPoints = availablePoints / loyalty.burnPointsPerDollar
      pointsAmount = Math.round(Math.min(maxDollarsFromPoints, remainingForCredits) * 100) / 100
      pointsRedeemedCount = Math.round(pointsAmount * loyalty.burnPointsPerDollar)
      if (pointsRedeemedCount > 0) {
        if (await redeemPoints(payload, customerId, pointsRedeemedCount)) {
          pointsRedeemedFlag = true
          remainingForCredits = Math.round((remainingForCredits - pointsAmount) * 100) / 100
        } else {
          pointsRedeemedCount = 0
          pointsAmount = 0
        }
      }
    }

    // Rolls back every credit claimed above, in one call — used at every
    // failure point below (stock conflict, order-creation failure, payment-
    // initiation failure), mirroring releaseDiscount's own rollback shape.
    const releaseCredits = async () => {
      if (discountRedeemed && discountId != null) await releaseDiscount(payload, discountId)
      if (giftCardRedeemed && giftCardId != null) await releaseGiftCardAmount(payload, giftCardId, giftCardAmount)
      if (storeCreditRedeemed && customerId != null) await releaseStoreCredit(payload, customerId, storeCreditApplied)
      if (pointsRedeemedFlag && customerId != null) await releasePoints(payload, customerId, pointsRedeemedCount)
    }

    const total = remainingForCredits + deliveryFee

    // LBP is a snapshot at purchase time, not a live conversion — a later
    // admin rate change must never retroactively change what an old order
    // "was worth" (ROADMAP F1 §2.5). USD stays the money of record either way.
    const currencyDisplay = resolveCurrencyDisplay(settings)
    const exchangeRateAtPurchase =
      currencyDisplay.mode === 'both' ? currencyDisplay.exchangeRate ?? undefined : undefined

    const decremented: StockLine[] = []
    for (const line of qtyByLine.values()) {
      const product = productById.get(line.productId)!
      if (!(await decrementStock(payload, line))) {
        await restoreStock(payload, decremented)
        await releaseCredits()
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
          ...(customerId ? { customer: customerId } : {}),
          deliveryAddress,
          area,
          items,
          subtotal,
          deliveryFee,
          discountCode,
          discountAmount,
          giftCardCode,
          giftCardAmount,
          storeCreditApplied,
          pointsRedeemed: pointsRedeemedCount,
          total,
          paymentMethod,
          paymentStatus: needsPaymentSession ? 'awaiting_payment' : 'pending',
          ...(needsPaymentSession
            ? { paymentExpiresAt: paymentExpiryDate(paymentMethod === 'omt' ? OMT_RESERVATION_HOURS * 60 : PAYMENT_EXPIRY_MINUTES) }
            : {}),
          ...(exchangeRateAtPurchase != null ? { exchangeRateAtPurchase } : {}),
          ...(utmSource ? { utmSource } : {}),
          ...(utmMedium ? { utmMedium } : {}),
          ...(utmCampaign ? { utmCampaign } : {}),
          orderStatus: 'pending',
          notes,
        },
      })
    } catch (err) {
      await restoreStock(payload, decremented)
      await releaseCredits()
      throw err
    }

    // Card/OMT: stock is already reserved (decremented above) — now open the
    // provider session (a hosted-checkout redirect for card, a voucher code
    // for OMT). paymentStatus only ever becomes `paid` via a verified webhook
    // (src/app/api/payments/webhook/[provider]/route.ts) or, for OMT v1, the
    // admin's manual "Mark as Paid" action — never trusted from this response.
    let payment: PaymentInitiateResult | null = null
    if (needsPaymentSession) {
      try {
        payment = await initiatePayment(payload, paymentProviderKey, {
          orderId: order.id,
          orderNumber: order.orderNumber as string,
          amount: total,
          currency: 'USD',
          customerEmail,
        })
      } catch (err) {
        console.error('[orders] Payment initiation failed, rolling back:', err)
        await restoreStock(payload, decremented)
        await releaseCredits()
        try {
          await payload.delete({ collection: 'orders', id: order.id })
        } catch (deleteErr) {
          console.error('[orders] Failed to roll back order after payment-initiation failure:', deleteErr)
        }
        return NextResponse.json(
          {
            error:
              paymentMethod === 'card'
                ? 'Card payments are temporarily unavailable. Please choose another payment method.'
                : 'OMT payments are temporarily unavailable. Please choose another payment method.',
          },
          { status: 502 },
        )
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
      exchangeRateAtPurchase,
      brand: resolveBrandCopy(settings),
    }

    // Card/OMT orders aren't confirmed yet — the Orders afterChange hook
    // sends this same notification once the order is marked paid (webhook or
    // admin manual confirm), so it isn't sent twice.
    if (!needsPaymentSession) {
      // after() keeps the serverless function alive past the response —
      // a plain void'd promise can be frozen before it completes on Vercel.
      // The invoice PDF is generated here too (not before the response) so
      // rendering it never adds latency to checkout itself (ROADMAP 3.1).
      const vatConfig = resolveVatConfig(settings)
      after(async () => {
        let invoicePdf: Buffer | undefined
        try {
          invoicePdf = await generateInvoicePdf({
            orderNumber: notificationData.orderNumber,
            createdAt: order.createdAt as string,
            customerName,
            customerEmail,
            deliveryAddress,
            area,
            items,
            subtotal,
            deliveryFee,
            discountAmount: discountAmount > 0 ? discountAmount : undefined,
            discountCode,
            total,
            storeName: notificationData.brand.storeName,
            contactEmail: notificationData.brand.contactEmail,
            vat: vatConfig.enabled ? { rate: vatConfig.rate, registrationNumber: vatConfig.registrationNumber } : undefined,
          })
        } catch (err) {
          console.error('[orders] Invoice PDF generation failed (email still sends without it):', err)
        }
        await Promise.allSettled([
          sendOrderConfirmationEmail({ ...notificationData, invoicePdf }),
          sendOrderWhatsAppAlert(notificationData),
        ])
      })
    }

    const successBody = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      ...(payment ? { payment } : {}),
    }
    if (idempotencyKey) await saveIdempotentResponse(payload, idempotencyKey, 201, successBody)
    return NextResponse.json(successBody, { status: 201 })
  } catch (err) {
    console.error('Order creation failed:', err)
    reportServerError(err, { route: 'orders' })
    return NextResponse.json({ error: 'Order creation failed' }, { status: 500 })
  }
}
