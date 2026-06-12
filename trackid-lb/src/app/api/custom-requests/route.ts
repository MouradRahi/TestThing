import { getPayload } from '@/lib/payload'
import { rateLimit, clientIp, cleanString, cleanOptional } from '@/lib/api-guards'
import { NextRequest, NextResponse } from 'next/server'

const GARMENT_TYPES = ['hoodie', 'tee', 'jacket', 'other'] as const

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`custom-requests:${clientIp(req)}`, 3, 10 * 60_000)) {
      return NextResponse.json(
        { error: 'Too many requests from this connection. Please wait a few minutes and try again.' },
        { status: 429 },
      )
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Honeypot — real users never see this field. Pretend success so bots move on.
    if (body.website) {
      return NextResponse.json({ success: true }, { status: 201 })
    }

    const name = cleanString(body.name, 120)
    const phone = cleanString(body.phone, 40)
    const description = cleanString(body.description, 2000)
    const email = cleanOptional(body.email, 160)
    const referenceArtist = cleanOptional(body.referenceArtist, 200)
    const referenceSong = cleanOptional(body.referenceSong, 200)
    const garmentType = GARMENT_TYPES.includes(body.garmentType) ? body.garmentType : undefined

    if (!name || !phone || !description || email === null || referenceArtist === null || referenceSong === null) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    const payload = await getPayload()

    await payload.create({
      collection: 'custom-requests',
      data: {
        name,
        phone,
        email,
        description,
        referenceArtist,
        referenceSong,
        garmentType,
        status: 'new',
      },
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('Custom request creation failed:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
