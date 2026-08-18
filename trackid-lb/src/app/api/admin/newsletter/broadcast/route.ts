import { getPayload } from '@/lib/payload'
import { requireAdminUser } from '@/lib/payments/admin-guard'
import { resolveBrandCopy } from '@/lib/site-settings'
import { logAuditEvent } from '@/lib/audit-log'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

// Admin drop-announcement broadcast (ROADMAP Part 7) — creates a Resend
// broadcast against the configured segment. sendNow:true sends immediately
// (after the client's own confirm dialog); the default is a draft the admin
// finishes reviewing in Resend's own dashboard, matching how this codebase
// gates every other money/reach-adjacent bulk action behind an explicit,
// non-default confirmation (e.g. RefundButton's confirm, the mock-payment
// simulate flow).
export async function POST(req: NextRequest) {
  const payload = await getPayload()
  const admin = await requireAdminUser(payload, req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const apiKey = process.env.RESEND_API_KEY
  const audienceId = process.env.RESEND_AUDIENCE_ID
  if (!apiKey || !audienceId) {
    return NextResponse.json({ error: 'Newsletter is not configured (RESEND_API_KEY / RESEND_AUDIENCE_ID).' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const subject = typeof body?.subject === 'string' ? body.subject.trim() : ''
  const html = typeof body?.html === 'string' ? body.html.trim() : ''
  const sendNow = body?.sendNow === true
  if (!subject || !html) {
    return NextResponse.json({ error: 'Subject and body are both required.' }, { status: 400 })
  }

  let brand
  try {
    const settings = await payload.findGlobal({ slug: 'site-settings' })
    brand = resolveBrandCopy(settings as unknown as Record<string, unknown>)
  } catch {
    brand = undefined
  }
  const storeName = brand?.storeName || 'Store'
  const from = process.env.RESEND_FROM || 'orders@trackid.lb'

  try {
    const resend = new Resend(apiKey)
    const base = { from: `${storeName} <${from}>`, subject, html, segmentId: audienceId, audienceId }
    const { data, error } = await resend.broadcasts.create(
      sendNow ? { ...base, send: true } : { ...base, send: false },
    )
    if (error) {
      console.error('[newsletter] Broadcast create error:', error)
      return NextResponse.json({ error: 'Failed to create broadcast' }, { status: 500 })
    }

    await logAuditEvent(payload, {
      collectionSlug: 'newsletter-broadcast',
      documentId: data?.id,
      action: 'create',
      req: { user: admin.user },
      summary: `${admin.email} ${sendNow ? 'sent' : 'drafted'} a newsletter broadcast: "${subject}"`,
    })

    return NextResponse.json({ ok: true, id: data?.id })
  } catch (err) {
    console.error('[newsletter] Broadcast failed:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
