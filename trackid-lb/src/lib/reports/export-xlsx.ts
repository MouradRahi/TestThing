import writeExcelFile from 'write-excel-file/node'
import type { ReportResult } from './types'

// write-excel-file over exceljs: exceljs pulls in an outdated
// archiver/archiver-utils/zip-stream chain with a high-severity
// brace-expansion DoS advisory (no fix short of a breaking downgrade).
// write-excel-file has zero dependencies and covers exactly what a report
// export needs (a single styled sheet) — no reason to carry that weight.
export async function reportToXlsx(result: ReportResult): Promise<Buffer> {
  const header = result.columns.map((c) => ({
    value: c.label,
    fontWeight: 'bold' as const,
    align: (c.align ?? 'left') as 'left' | 'right',
  }))
  const rows = result.rows.map((row) =>
    result.columns.map((c) => {
      const v = row[c.key]
      return {
        value: v == null ? '' : String(v),
        align: (c.align ?? 'left') as 'left' | 'right',
      }
    }),
  )
  return writeExcelFile([header, ...rows]).toBuffer()
}
