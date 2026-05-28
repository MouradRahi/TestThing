import { getPayload } from '@/lib/payload'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, phone, email, description, referenceArtist, referenceSong, garmentType } = body

    if (!name || !phone || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const payload = await getPayload()

    await payload.create({
      collection: 'custom-requests',
      data: {
        name,
        phone,
        email: email || undefined,
        description,
        referenceArtist: referenceArtist || undefined,
        referenceSong: referenceSong || undefined,
        garmentType: garmentType || undefined,
        status: 'new',
      },
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('Custom request creation failed:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
