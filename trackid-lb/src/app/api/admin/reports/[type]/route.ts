import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { requireAdminUser } from '@/lib/payments/admin-guard'
import { getPool } from '@/lib/db-pool'
import { buildReport, isReportType } from '@/lib/reports/registry'

// JSON preview for the admin Reports panel (ROADMAP Part 4 §4.1) — the same
// report definitions the export route uses, just returned as data instead
// of a file, so the UI can render a table before anyone downloads anything.
export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const payload = await getPayload()
  const admin = await requireAdminUser(payload, req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  if (!isReportType(type)) return NextResponse.json({ error: 'Unknown report type' }, { status: 404 })

  const pool = getPool(payload)
  if (!pool) return NextResponse.json({ error: 'Database pool unavailable' }, { status: 500 })

  const sp = req.nextUrl.searchParams
  try {
    const result = await buildReport(type, pool, {
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
      groupBy: sp.get('groupBy') ?? undefined,
      dimension: sp.get('dimension') ?? undefined,
      locale: sp.get('locale') ?? undefined,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error(`[reports] Failed to build "${type}" report:`, err)
    return NextResponse.json({ error: 'Failed to build report' }, { status: 500 })
  }
}
