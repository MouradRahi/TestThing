'use client'

import { useFormFields } from '@payloadcms/ui'

// UI field on Orders (ROADMAP Part 3.1) — reads the current form's
// orderNumber and links to the same public invoice route the storefront
// uses (/api/invoices/[orderNumber]); staff are already authenticated to be
// looking at this page at all, so no separate admin-only route is needed.
// Renders nothing on the "create new order" screen (orders are only ever
// created by the storefront checkout API) — orderNumber won't exist yet.
export function InvoiceDownloadField() {
  const orderNumber = useFormFields(([fields]) => fields?.orderNumber?.value as string | undefined)
  if (!orderNumber) return null

  return (
    <div style={{ marginBottom: '1rem' }}>
      <a
        href={`/api/invoices/${orderNumber}`}
        target="_blank"
        rel="noreferrer"
        className="btn btn--style-secondary btn--size-small"
      >
        Download Invoice (PDF)
      </a>
    </div>
  )
}
