import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { verifyCartRecoveryToken } from '@/lib/unsubscribe-token'

// One-click unsubscribe from abandoned-cart recovery emails (ROADMAP Part
// 6.5) — no login required, deliberately (an unsubscribe link that demands a
// login is a dark pattern). The signed token is the access control.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const customerId = sp.get('customer')
  const token = sp.get('token')

  if (!customerId || !token || !verifyCartRecoveryToken(customerId, token)) {
    return new NextResponse('<!DOCTYPE html><p>This unsubscribe link is invalid or has expired.</p>', {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const payload = await getPayload()
  try {
    await payload.update({
      collection: 'customers',
      id: customerId,
      data: { cartRecoveryOptOut: true },
      overrideAccess: true,
    })
  } catch {
    return new NextResponse('<!DOCTYPE html><p>Something went wrong. Please try again later.</p>', {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  return new NextResponse(
    '<!DOCTYPE html><p style="font-family:sans-serif;padding:40px;">You’ve been unsubscribed from cart reminder emails. You can close this tab.</p>',
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
