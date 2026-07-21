import { getPayload } from '@/lib/payload'
import { clientIp, isValidPhone } from '@/lib/api-guards'
import { durableRateLimit } from '@/lib/durable-rate-limit'
import { NextRequest, NextResponse } from 'next/server'

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// Update the logged-in customer's own profile (name, phone, saved addresses).
export async function POST(req: NextRequest) {
  const payload = await getPayload()
  if (!(await durableRateLimit(payload, `profile:${clientIp(req)}`, 20, 10 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  const { user } = await payload.auth({ headers: req.headers })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!user || (user as any).collection !== 'customers') {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}
  if (typeof body.name === 'string') {
    const name = str(body.name, 120)
    if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
    data.name = name
  }
  if ('phone' in body) {
    const phone = str(body.phone, 40)
    // A junk phone saved here prefills checkout later and dead-ends there — reject now
    if (phone && !isValidPhone(phone)) {
      return NextResponse.json({ error: 'Please enter a valid phone number.' }, { status: 400 })
    }
    data.phone = phone || undefined
  }
  if (Array.isArray(body.addresses)) {
    data.addresses = body.addresses.slice(0, 10).map((a: Record<string, unknown>) => ({
      label: str(a?.label, 60),
      area: str(a?.area, 120),
      deliveryAddress: str(a?.deliveryAddress, 500),
    }))
  }

  try {
    await payload.update({ collection: 'customers', id: user.id, data, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  }
}
