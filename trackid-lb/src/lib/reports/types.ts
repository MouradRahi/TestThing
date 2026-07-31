// Shared shape every report definition returns (ROADMAP Part 4 §4.1) — one
// generic structure so a single admin UI, and a single set of CSV/XLSX/PDF
// exporters, can serve every report type without per-type export code.

export type ReportColumn = {
  key: string
  label: string
  align?: 'left' | 'right'
}

export type ReportSummaryItem = { label: string; value: string }

export type ReportResult = {
  title: string
  subtitle?: string
  generatedAt: string
  columns: ReportColumn[]
  rows: Array<Record<string, string | number | null>>
  summary?: ReportSummaryItem[]
}

export type ReportParams = {
  from?: string
  to?: string
  groupBy?: string
  dimension?: string
  locale?: string
}
