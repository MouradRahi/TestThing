import type { PgPool } from '../db-pool'
import type { ReportParams, ReportResult } from './types'
import { buildSalesReport } from './sales'
import { buildInventoryReport } from './inventory'
import { buildCustomersReport } from './customers'
import { buildDiscountsReport } from './discounts'
import { buildPaymentsReport } from './payments'
import { buildVatReport } from './vat'

export const REPORT_TYPES = [
  { key: 'sales', label: 'Sales' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'customers', label: 'Customers' },
  { key: 'discounts', label: 'Discounts' },
  { key: 'payments', label: 'Payments' },
  { key: 'vat', label: 'VAT' },
] as const

export type ReportType = (typeof REPORT_TYPES)[number]['key']

export function isReportType(value: string): value is ReportType {
  return REPORT_TYPES.some((r) => r.key === value)
}

export async function buildReport(type: ReportType, pool: PgPool, params: ReportParams): Promise<ReportResult> {
  switch (type) {
    case 'sales': return buildSalesReport(pool, params)
    case 'inventory': return buildInventoryReport(pool, params)
    case 'customers': return buildCustomersReport(pool, params)
    case 'discounts': return buildDiscountsReport(pool, params)
    case 'payments': return buildPaymentsReport(pool, params)
    case 'vat': return buildVatReport(pool, params)
  }
}
