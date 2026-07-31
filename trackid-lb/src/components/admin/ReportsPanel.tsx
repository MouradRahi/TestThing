import React from 'react'
import { isAdmin } from '@/lib/access'
import { ReportsExplorer } from './ReportsExplorer'

// Report engine admin surface (ROADMAP Part 4 §4.1) — pick a report, set
// params, preview a table, export CSV/XLSX/PDF. Revenue-adjacent, same gate
// as SalesDashboard/PaymentsOpsPanel.
export async function ReportsPanel(props: { user?: unknown }) {
  if (!isAdmin(props.user)) return null

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Reports</h2>
      <ReportsExplorer />
    </div>
  )
}
