import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { recordPageView } from '@/lib/analytics'
import { PAGEVIEW_TOKEN_HEADER, getPageviewToken } from '@/lib/pageview-token'

// Fire-and-forget pageview ping from middleware.ts (ROADMAP Part 4 §4.3's
// "lightweight own counter" — no cookies, no per-user tracking, just a daily
// aggregate total). Only our own middleware may call it: the token check runs
// before Payload is even initialized, so an outside caller costs almost no CPU
// and can't inflate the count. One DB write per real page view.
export async function POST(req: NextRequest) {
  if (req.headers.get(PAGEVIEW_TOKEN_HEADER) !== (await getPageviewToken())) {
    return new NextResponse(null, { status: 403 })
  }
  const payload = await getPayload()
  await recordPageView(payload)
  return new NextResponse(null, { status: 204 })
}
