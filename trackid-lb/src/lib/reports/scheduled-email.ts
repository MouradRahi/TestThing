import { Resend } from 'resend'
import type { PgPool } from '../db-pool'
import type { ReportType } from './registry'
import { buildReport } from './registry'
import { reportToCsv } from './export-csv'

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export type ScheduledReportsResult = { sent: boolean; reason?: string }

// The weekly/monthly digest email (ROADMAP Part 4 §4.2) — same
// build-then-attach-CSV approach as the admin Reports panel's export, just
// automated. Deliberately attaches CSV only (not XLSX/PDF) to keep the email
// itself lightweight; the admin panel covers the other formats on demand.
// Same skip-gracefully-without-RESEND_API_KEY convention as notifications.ts.
export async function sendScheduledReportEmail(
  pool: PgPool,
  brand: { storeName: string; replyTo?: string },
  recipients: string[],
  types: ReportType[],
  from: Date,
  to: Date,
  cadenceLabel: string,
): Promise<ScheduledReportsResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[scheduled-reports] RESEND_API_KEY not set — skipping')
    return { sent: false, reason: 'no_api_key' }
  }
  if (recipients.length === 0) return { sent: false, reason: 'no_recipients' }
  if (types.length === 0) return { sent: false, reason: 'no_report_types' }

  const results = await Promise.all(
    types.map((t) => buildReport(t, pool, { from: from.toISOString(), to: to.toISOString() })),
  )

  const sectionsHtml = results
    .map((r) => {
      const summaryHtml = (r.summary ?? [])
        .map(
          (s) =>
            `<div style="display:inline-block;margin:0 20px 8px 0"><div style="font-size:11px;color:#666;text-transform:uppercase">${escapeHtml(s.label)}</div><div style="font-size:18px;font-weight:700">${escapeHtml(s.value)}</div></div>`,
        )
        .join('')
      return `<h3 style="margin:24px 0 6px;font-size:15px">${escapeHtml(r.title)}</h3>${summaryHtml || '<div style="color:#888;font-size:13px">No data in this period.</div>'}`
    })
    .join('')

  const html = `<div style="font-family:-apple-system,sans-serif;color:#111;max-width:600px">
    <h2 style="margin:0 0 4px">${escapeHtml(brand.storeName)} — ${escapeHtml(cadenceLabel)} report</h2>
    <p style="color:#666;font-size:13px;margin:0 0 8px">
      Period: ${from.toLocaleDateString('en-US')} – ${to.toLocaleDateString('en-US')}
    </p>
    ${sectionsHtml}
    <p style="color:#999;font-size:12px;margin-top:28px">
      Full detail attached as CSV for each report. View live figures anytime in Admin → Reports.
    </p>
  </div>`

  const attachments = results.map((r, i) => ({
    filename: `${types[i]}-report-${to.toISOString().slice(0, 10)}.csv`,
    content: reportToCsv(r),
  }))

  const resend = new Resend(apiKey)
  const from_ = process.env.RESEND_FROM || 'orders@trackid.lb'

  try {
    const { error } = await resend.emails.send({
      from: `${brand.storeName} <${from_}>`,
      to: recipients,
      ...(brand.replyTo ? { replyTo: brand.replyTo } : {}),
      subject: `${brand.storeName} — ${cadenceLabel} report (${to.toLocaleDateString('en-US')})`,
      html,
      attachments,
    })
    if (error) {
      console.error('[scheduled-reports] Resend error:', error)
      return { sent: false, reason: 'resend_error' }
    }
    return { sent: true }
  } catch (err) {
    console.error('[scheduled-reports] Send failed:', err)
    return { sent: false, reason: 'exception' }
  }
}
