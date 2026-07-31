import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { getPool } from '@/lib/db-pool'
import { resolveBrandCopy } from '@/lib/site-settings'
import { sendScheduledReportEmail } from '@/lib/reports/scheduled-email'
import type { ReportType } from '@/lib/reports/registry'

// Weekly/monthly report digest (ROADMAP Part 4 §4.2) — same auth pattern as
// the other crons (cleanup-carts, expire-payments): open in dev, needs
// CRON_SECRET in production (Vercel signs its own Cron Job requests with
// this as a Bearer token automatically once the env var is set).
//
// Runs daily (vercel.json) but only actually sends on the configured
// cadence's due day — weekly on Mondays, monthly on the 1st — and only once
// per period (reportsEmailLastSentAt dedupe guard), so a daily-only cron
// ceiling (Vercel Hobby) doesn't cause it to fire more than once per period.
function authorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

const DAY = 86_400_000

function isDueToday(cadence: string, now: Date): boolean {
  if (cadence === 'monthly') return now.getUTCDate() === 1
  return now.getUTCDay() === 1 // weekly → Monday
}

function alreadySentToday(lastSentAt: unknown, now: Date): boolean {
  if (typeof lastSentAt !== 'string') return false
  const last = new Date(lastSentAt)
  if (Number.isNaN(last.getTime())) return false
  return last.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayload()
  const settings = (await payload.findGlobal({ slug: 'site-settings' })) as unknown as Record<string, unknown>

  if (!settings.reportsEmailEnabled) {
    return NextResponse.json({ ok: true, skipped: 'disabled' })
  }

  const now = new Date()
  const cadence = (settings.reportsEmailCadence as string) || 'weekly'
  if (!isDueToday(cadence, now)) {
    return NextResponse.json({ ok: true, skipped: 'not_due_today' })
  }
  if (alreadySentToday(settings.reportsEmailLastSentAt, now)) {
    return NextResponse.json({ ok: true, skipped: 'already_sent_today' })
  }

  const pool = getPool(payload)
  if (!pool) {
    return NextResponse.json({ ok: false, error: 'Database pool unavailable' }, { status: 500 })
  }

  const types: ReportType[] = (
    [
      ['sendSalesReport', 'sales'],
      ['sendInventoryReport', 'inventory'],
      ['sendCustomersReport', 'customers'],
      ['sendDiscountsReport', 'discounts'],
      ['sendPaymentsReport', 'payments'],
    ] as const
  )
    .filter(([field]) => !!settings[field])
    .map(([, type]) => type)

  const recipients = String(settings.reportsEmailRecipients ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.includes('@'))

  const brand = resolveBrandCopy(settings)
  if (recipients.length === 0 && brand.contactEmail) recipients.push(brand.contactEmail)

  const days = cadence === 'monthly' ? 30 : 7
  const from = new Date(now.getTime() - days * DAY)
  const cadenceLabel = cadence === 'monthly' ? 'Monthly' : 'Weekly'

  const result = await sendScheduledReportEmail(
    pool,
    { storeName: brand.storeName, replyTo: brand.contactEmail },
    recipients,
    types,
    from,
    now,
    cadenceLabel,
  )

  if (result.sent) {
    await payload.updateGlobal({ slug: 'site-settings', data: { reportsEmailLastSentAt: now.toISOString() } })
  }

  return NextResponse.json({ ok: true, ...result, types, recipients: recipients.length })
}
