import { getPayload } from '@/lib/payload'
import { clientIp, cleanString, cleanOptional } from '@/lib/api-guards'
import { durableRateLimit } from '@/lib/durable-rate-limit'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload()
    if (!(await durableRateLimit(payload, `custom-requests:${clientIp(req)}`, 3, 10 * 60_000))) {
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

    if (!name || !phone || !description || email === null || referenceArtist === null || referenceSong === null) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    // Validate the garment type against the admin-managed list (ignore if unknown)
    let garmentType: string | number | undefined = undefined
    if (body.garmentType) {
      try {
        const gt = await payload.findByID({ collection: 'garment-types', id: body.garmentType, depth: 0 })
        if (gt) garmentType = gt.id
      } catch {
        garmentType = undefined
      }
    }

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
