import type { ReportParams } from './types'

const DAY = 86_400_000

// Every report defaults to "last 30 days" when no explicit range is given —
// matches the admin dashboard's own default window.
export function resolveDateRange(params: ReportParams): { from: Date; to: Date } {
  const to = params.to ? new Date(params.to) : new Date()
  const from = params.from ? new Date(params.from) : new Date(to.getTime() - 30 * DAY)
  from.setHours(0, 0, 0, 0)
  to.setHours(23, 59, 59, 999)
  return { from, to }
}

export function money(n: number | string | null | undefined): string {
  const v = typeof n === 'string' ? Number(n) : n
  return `$${(v ?? 0).toFixed(2)}`
}
