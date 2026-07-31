import type { ReportResult } from './types'

// Same escaping convention as the existing payments CSV export
// (src/app/api/admin/payments/export/route.ts) — kept independent rather
// than shared, since that route's column set is fixed and this one is
// per-report-type dynamic.
function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function reportToCsv(result: ReportResult): string {
  const header = result.columns.map((c) => csvEscape(c.label)).join(',')
  const rows = result.rows.map((row) => result.columns.map((c) => csvEscape(row[c.key])).join(','))
  return [header, ...rows].join('\n')
}
