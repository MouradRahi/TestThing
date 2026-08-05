import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { durableRateLimit } from '@/lib/durable-rate-limit'
import { clientIp } from '@/lib/api-guards'
import { recordPageView } from '@/lib/analytics'

// Fire-and-forget pageview ping from middleware.ts (ROADMAP Part 4 §4.3's
// "lightweight own counter" — no cookies, no per-user tracking, just a daily
// aggregate total). Public and unauthenticated by necessity (every visitor
// hits this), so rate-limited to blunt trivial abuse — this only inflates an
// internal dashboard number, not a security boundary, hence the generous cap.
export async function POST(req: NextRequest) {
  const payload = await getPayload()
  if (!(await durableRateLimit(payload, `pageview:${clientIp(req)}`, 300, 10 * 60_000))) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }
  await recordPageView(payload)
  return NextResponse.json({ ok: true })
}
