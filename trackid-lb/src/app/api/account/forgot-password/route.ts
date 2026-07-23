import { getPayload } from '@/lib/payload'
import { getSiteSettings, resolveBrandCopy, resolveStoreName } from '@/lib/site-settings'
import { sendPasswordResetEmail } from '@/lib/notifications'
import { clientIp, cleanString, EMAIL_RE } from '@/lib/api-guards'
import { durableRateLimit } from '@/lib/durable-rate-limit'
import { routing } from '@/i18n/routing'
import { NextRequest, NextResponse } from 'next/server'

// Always responds { ok: true } for a well-formed request, whether or not the
// email is registered — revealing which emails have accounts is an
// enumeration risk. Rate-limited by IP so it can't be used to spam an inbox.
export async function POST(req: NextRequest) {
  const payload = await getPayload()
  if (!(await durableRateLimit(payload, `forgot-password:${clientIp(req)}`, 5, 10 * 60_000))) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const email = cleanString(body?.email, 160)
  const locale = typeof body?.locale === 'string' && routing.locales.includes(body.locale as never) ? body.locale : routing.defaultLocale

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase()

  try {
    // disableEmail: Payload has no email adapter configured — the app sends
    // its own branded Resend email below with the token this returns.
    const token = await payload.forgotPassword({
      collection: 'customers',
      data: { email: normalizedEmail },
      disableEmail: true,
    })

    // Payload returns null (not a rejected promise) when no account matches —
    // that's the "fail silently" case; still respond ok below either way.
    if (token) {
      const { docs } = await payload.find({
        collection: 'customers',
        where: { email: { equals: normalizedEmail } },
        limit: 1,
      })
      const customer = docs[0]

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      const localePrefix = locale === routing.defaultLocale ? '' : `/${locale}`
      const resetUrl = `${siteUrl}${localePrefix}/account/reset/${token}`

      const settings = await getSiteSettings(locale)
      await sendPasswordResetEmail({
        customerEmail: normalizedEmail,
        customerName: (customer?.name as string) || resolveStoreName(settings),
        resetUrl,
        brand: resolveBrandCopy(settings),
      })
    }
  } catch {
    // Swallow — never leak whether the account exists or why the operation failed.
  }

  return NextResponse.json({ ok: true })
}
