import { getPayload } from '@/lib/payload'
import { clientIp, EMAIL_RE } from '@/lib/api-guards'
import { durableRateLimit } from '@/lib/durable-rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

// Newsletter capture (ROADMAP Part 7) — adds the submitted email to a Resend
// "segment" (Resend's current, non-deprecated primitive; the env var keeps
// the more recognizable "audience" name since that's still how Resend's own
// dashboard commonly refers to it, and how the roadmap names the feature).
// Degrades gracefully with no error surfaced to the customer when unconfigured
// — same convention as every other optional integration in this codebase.
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload()
    if (!(await durableRateLimit(payload, `newsletter:${clientIp(req)}`, 5, 10 * 60_000))) {
      return NextResponse.json({ error: 'Too many requests. Please wait a few minutes and try again.' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Honeypot — real users never see this field. Pretend success so bots move on.
    if (body.website) {
      return NextResponse.json({ success: true }, { status: 201 })
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!email || email.length > 160 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    const audienceId = process.env.RESEND_AUDIENCE_ID
    if (!apiKey || !audienceId) {
      console.warn('[newsletter] RESEND_API_KEY / RESEND_AUDIENCE_ID not set — skipping signup')
      // Not the customer's fault — respond success rather than surfacing an
      // internal config gap as a form error.
      return NextResponse.json({ success: true }, { status: 200 })
    }

    const resend = new Resend(apiKey)
    const { error } = await resend.contacts.create({ email, segments: [{ id: audienceId }] })
    if (error) {
      console.error('[newsletter] Resend contact create error:', error)
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('[newsletter] Signup failed:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
