import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { requireAdminUser } from '@/lib/payments/admin-guard'
import { getPool } from '@/lib/db-pool'
import { buildReport, isReportType } from '@/lib/reports/registry'
import { reportToCsv } from '@/lib/reports/export-csv'
import { reportToXlsx } from '@/lib/reports/export-xlsx'
import { reportToPdf } from '@/lib/reports/export-pdf'
import { resolveStoreName } from '@/lib/site-settings'

// File export for the admin Reports panel — a plain <a href> download link
// (cookie-authenticated, same pattern as the existing payments CSV export),
// not a fetch call, so the browser's own download handling does the work.
export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const payload = await getPayload()
  const admin = await requireAdminUser(payload, req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  if (!isReportType(type)) return NextResponse.json({ error: 'Unknown report type' }, { status: 404 })

  const pool = getPool(payload)
  if (!pool) return NextResponse.json({ error: 'Database pool unavailable' }, { status: 500 })

  const sp = req.nextUrl.searchParams
  const format = sp.get('format') ?? 'csv'

  let result
  try {
    result = await buildReport(type, pool, {
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
      groupBy: sp.get('groupBy') ?? undefined,
      dimension: sp.get('dimension') ?? undefined,
      locale: sp.get('locale') ?? undefined,
    })
  } catch (err) {
    console.error(`[reports] Failed to build "${type}" report for export:`, err)
    return NextResponse.json({ error: 'Failed to build report' }, { status: 500 })
  }

  const datestamp = new Date().toISOString().slice(0, 10)
  const filenameBase = `${type}-report-${datestamp}`

  if (format === 'xlsx') {
    const buf = await reportToXlsx(result)
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filenameBase}.xlsx"`,
      },
    })
  }

  if (format === 'pdf') {
    let settings: Record<string, unknown> = {}
    try {
      settings = (await payload.findGlobal({ slug: 'site-settings' })) as unknown as Record<string, unknown>
    } catch {
      // fresh install without the global — resolveStoreName applies a default
    }
    const buf = await reportToPdf(result, resolveStoreName(settings))
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filenameBase}.pdf"`,
      },
    })
  }

  const csv = reportToCsv(result)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filenameBase}.csv"`,
    },
  })
}
