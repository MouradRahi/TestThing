import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { resolveBrandCopy } from '@/lib/site-settings'
import { sendAbandonedCartEmail } from '@/lib/notifications'
import { serializeCart } from '@/lib/cart-server'
import { signCartRecoveryToken } from '@/lib/unsubscribe-token'
import { getSiteUrl } from '@/lib/env'

// Abandoned-cart recovery (ROADMAP Part 6.5) — same daily-cron auth pattern
// as the other crons. Only logged-in customers qualify (guest carts have no
// captured email to send to); sends exactly once per cart ever, via the
// per-cart `recoveryEmailSentAt` flag — not a daily dedupe like the other
// crons, since "one recovery email per abandoned cart" is the actual rule,
// not "one per day."
function authorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

const IDLE_HOURS = 24
const SITE_URL = getSiteUrl()

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await getPayload()
  const idleSince = new Date(Date.now() - IDLE_HOURS * 60 * 60 * 1000).toISOString()

  const { docs: candidates } = await payload.find({
    collection: 'carts',
    where: {
      and: [
        { customer: { exists: true } },
        { recoveryEmailSentAt: { exists: false } },
        { updatedAt: { less_than: idleSince } },
      ],
    },
    limit: 200,
    depth: 0,
  })

  const settings = (await payload.findGlobal({ slug: 'site-settings' })) as unknown as Record<string, unknown>
  const brand = resolveBrandCopy(settings)

  let sent = 0
  for (const cart of candidates) {
    if (!Array.isArray(cart.items) || cart.items.length === 0) continue

    const customerId = typeof cart.customer === 'object' ? (cart.customer as { id: number }).id : cart.customer
    if (!customerId) continue

    try {
      const customer = await payload.findByID({ collection: 'customers', id: customerId, depth: 0 })
      if (!customer?.email || customer.cartRecoveryOptOut) continue

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { items: resolved } = await serializeCart(payload, { id: cart.id, items: cart.items as any }, undefined)
      if (resolved.length === 0) continue // everything in the cart is gone/unpublished now

      const token = signCartRecoveryToken(customerId)
      await sendAbandonedCartEmail({
        customerEmail: customer.email,
        customerName: customer.name || 'there',
        items: resolved.map((i) => ({ title: i.title, price: i.price, quantity: i.quantity, size: i.size })),
        cartUrl: `${SITE_URL}/cart`,
        unsubscribeUrl: `${SITE_URL}/api/account/cart-recovery-optout?customer=${customerId}&token=${token}`,
        brand,
      })
      await payload.update({ collection: 'carts', id: cart.id, data: { recoveryEmailSentAt: new Date().toISOString() } })
      sent++
    } catch (err) {
      console.error(`[cron] Abandoned-cart recovery failed for cart ${cart.id}:`, err)
    }
  }

  return NextResponse.json({ ok: true, checked: candidates.length, sent })
}
