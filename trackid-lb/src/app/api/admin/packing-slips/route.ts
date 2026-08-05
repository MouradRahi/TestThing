import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { requireAdminUser } from '@/lib/payments/admin-guard'
import { resolveBrandCopy } from '@/lib/site-settings'

// Printable packing-slip batch view (ROADMAP Part 3.2) — one slip per
// `confirmed` order, styled for browser printing (page-break per slip).
// Plain HTML rather than a PDF: this is meant to be opened, glanced at, and
// printed via Ctrl+P by whoever is packing — a PDF adds no value there and
// this route reuses none of the report-engine's PDF machinery on purpose.
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function GET(req: NextRequest) {
  const payload = await getPayload()
  const admin = await requireAdminUser(payload, req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const settings = (await payload.findGlobal({ slug: 'site-settings' })) as unknown as Record<string, unknown>
  const brand = resolveBrandCopy(settings)

  const { docs: orders } = await payload.find({
    collection: 'orders',
    where: { orderStatus: { equals: 'confirmed' } },
    sort: 'createdAt',
    limit: 200,
    depth: 0,
  })

  const slips = orders
    .map((o) => {
      const items: Array<{ titleAtPurchase: string; size?: string | null; quantity: number }> = Array.isArray(
        o.items,
      )
        ? o.items
        : []
      const itemsHtml = items
        .map(
          (item) =>
            `<tr><td>${escapeHtml(item.titleAtPurchase)}${item.size ? ` (${escapeHtml(item.size)})` : ''}</td><td style="text-align:right">× ${item.quantity}</td></tr>`,
        )
        .join('')
      return `
        <div class="slip">
          <div class="header">
            <div class="brand">${escapeHtml(brand.storeName)}</div>
            <div class="order-number">${escapeHtml(String(o.orderNumber))}</div>
          </div>
          <table class="meta">
            <tr><td>Customer</td><td>${escapeHtml(String(o.customerName))}</td></tr>
            <tr><td>Phone</td><td>${escapeHtml(String(o.customerPhone))}</td></tr>
            <tr><td>Area</td><td>${escapeHtml(String(o.area))}</td></tr>
            <tr><td>Address</td><td>${escapeHtml(String(o.deliveryAddress)).replace(/\n/g, '<br>')}</td></tr>
          </table>
          <table class="items">${itemsHtml}</table>
          ${o.notes ? `<div class="notes">Note: ${escapeHtml(String(o.notes))}</div>` : ''}
        </div>`
    })
    .join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Packing slips — ${orders.length} confirmed order${orders.length === 1 ? '' : 's'}</title>
  <style>
    body { font-family: -apple-system, sans-serif; color: #111; margin: 0; padding: 16px; }
    .toolbar { margin-bottom: 16px; }
    .toolbar button { font-size: 14px; padding: 8px 16px; cursor: pointer; }
    .slip { border: 1px solid #ccc; border-radius: 4px; padding: 20px; margin-bottom: 20px; max-width: 480px; page-break-after: always; }
    .header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 12px; }
    .brand { font-weight: 700; font-size: 16px; }
    .order-number { font-family: monospace; font-size: 13px; color: #555; }
    table.meta td { padding: 2px 0; font-size: 13px; vertical-align: top; }
    table.meta td:first-child { color: #777; padding-right: 12px; white-space: nowrap; }
    table.items { width: 100%; margin-top: 14px; border-top: 1px solid #ddd; padding-top: 8px; font-size: 13px; }
    table.items td { padding: 3px 0; }
    .notes { margin-top: 12px; font-size: 12px; color: #555; font-style: italic; }
    .empty { color: #777; }
    @media print { .toolbar { display: none; } }
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Print</button></div>
  ${orders.length === 0 ? '<p class="empty">No confirmed orders awaiting fulfillment.</p>' : slips}
</body>
</html>`

  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
