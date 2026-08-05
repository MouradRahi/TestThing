import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { resolveBrandCopy } from '@/lib/site-settings'
import { sendLowStockAlertEmail } from '@/lib/notifications'
import { getSizes } from '@/lib/stock'

// Low-stock email digest (ROADMAP Part 3.3) — same auth + daily-cron-computes-
// its-own-due-day shape as the other crons (cleanup-carts, expire-payments,
// scheduled-reports). Only sends once per day, and only when there's
// actually something to report — a quiet day never touches
// lowStockAlertLastSentAt, so the guard doesn't suppress tomorrow's real alert.
function authorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

function alreadySentToday(lastSentAt: unknown, now: Date): boolean {
  if (typeof lastSentAt !== 'string') return false
  const last = new Date(lastSentAt)
  if (Number.isNaN(last.getTime())) return false
  return last.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await getPayload()
  const settings = (await payload.findGlobal({ slug: 'site-settings' })) as unknown as Record<string, unknown>

  if (!settings.lowStockAlertEnabled) return NextResponse.json({ ok: true, skipped: 'disabled' })

  const now = new Date()
  if (alreadySentToday(settings.lowStockAlertLastSentAt, now)) {
    return NextResponse.json({ ok: true, skipped: 'already_sent_today' })
  }

  const brand = resolveBrandCopy(settings)
  if (!brand.contactEmail) return NextResponse.json({ ok: true, skipped: 'no_contact_email' })

  const threshold = typeof settings.lowStockThreshold === 'number' ? settings.lowStockThreshold : 3

  const { docs: products } = await payload.find({
    collection: 'products',
    where: { status: { equals: 'published' } },
    limit: 1000,
    depth: 0,
  })

  const low: Array<{ title: string; size?: string; stock: number }> = []
  for (const p of products) {
    const sizes = getSizes(p)
    if (sizes.length > 0) {
      for (const s of sizes) {
        if (s.stockQuantity <= threshold) low.push({ title: String(p.title), size: s.label, stock: s.stockQuantity })
      }
    } else {
      const stock = typeof p.stockQuantity === 'number' ? p.stockQuantity : 0
      if (stock <= threshold) low.push({ title: String(p.title), stock })
    }
  }

  if (low.length === 0) return NextResponse.json({ ok: true, skipped: 'nothing_low' })

  await sendLowStockAlertEmail({ recipientEmail: brand.contactEmail, brand, products: low })
  await payload.updateGlobal({ slug: 'site-settings', data: { lowStockAlertLastSentAt: now.toISOString() } })

  return NextResponse.json({ ok: true, sent: true, count: low.length })
}
