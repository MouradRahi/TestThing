import { Resend } from 'resend'
import { formatLBP } from './format'

export type OrderNotificationData = {
  orderId: string
  orderNumber: string
  customerName: string
  customerPhone: string
  customerEmail?: string | null
  deliveryAddress: string
  area: string
  items: Array<{
    titleAtPurchase: string
    priceAtPurchase: number
    quantity: number
    size?: string
  }>
  subtotal: number
  total: number
  /** Discount code applied, if any */
  discountCode?: string
  /** Amount taken off the subtotal by the discount code */
  discountAmount?: number
  paymentMethod: 'cod' | 'bank_transfer' | 'card' | 'omt'
  /** e.g. "Free" or "$4.00" — omitted when no delivery zones are configured */
  deliveryFeeLabel?: string
  /** LBP-per-USD rate snapshotted at purchase (ROADMAP F1 §2.5) — omitted when currency display is USD-only. */
  exchangeRateAtPurchase?: number
  /** Bank transfer payment details from SiteSettings, only set for bank_transfer orders */
  bankInstructions?: string
  /** Brand voice from SiteSettings → Copy tab. Defaults applied when omitted. */
  brand?: BrandCopy
  /** Rendered invoice PDF (ROADMAP Part 3.1) — attached when the caller supplies one; never generated here (this file stays a pure renderer with no Payload/DB access). */
  invoicePdf?: Buffer
}

// Mirror of site-settings.ts BrandCopy — duplicated here so this stays a pure
// renderer with no SiteSettings/Payload import. Callers pass resolved strings.
export type BrandCopy = {
  storeName: string
  emailGreeting: string
  emailFooterNote: string
  /** Reply-to for transactional emails (SiteSettings → Brand → contactEmail) */
  contactEmail?: string
}

const DEFAULT_BRAND: BrandCopy = {
  storeName: 'trackID.lb',
  emailGreeting:
    'Thank you for supporting the music. Our team will reach out on WhatsApp to confirm your delivery details and arrange handoff.',
  emailFooterNote: "Lebanon's music fashion brand.",
}

// Customer-supplied values go straight into email HTML — escape them so a
// crafted name/address can't inject markup into mail sent from our domain.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// --- Email ---

export async function sendOrderConfirmationEmail(order: OrderNotificationData): Promise<void> {
  if (!order.customerEmail) return

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[notifications] RESEND_API_KEY not set — skipping confirmation email')
    return
  }

  const resend = new Resend(apiKey)
  const from = process.env.RESEND_FROM || 'orders@trackid.lb'
  const replyTo = order.brand?.contactEmail

  try {
    const { error } = await resend.emails.send({
      from,
      to: order.customerEmail,
      ...(replyTo ? { replyTo } : {}),
      subject: `Order confirmed — ${order.orderNumber}`,
      html: buildOrderEmailHtml(order),
      ...(order.invoicePdf
        ? { attachments: [{ filename: `invoice-${order.orderNumber}.pdf`, content: order.invoicePdf }] }
        : {}),
    })
    if (error) console.error('[notifications] Resend error:', error)
  } catch (err) {
    console.error('[notifications] Failed to send confirmation email:', err)
  }
}

function buildOrderEmailHtml(order: OrderNotificationData): string {
  const itemsHtml = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #1a1a1a; font-size: 13px; color: #c0b8ae;">${escapeHtml(item.titleAtPurchase)}${item.size ? ` <span style="color:#666;">(${escapeHtml(item.size)})</span>` : ''}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #1a1a1a; font-size: 13px; color: #666; text-align: center;">×${item.quantity}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #1a1a1a; font-size: 13px; color: #c0b8ae; text-align: right; font-variant-numeric: tabular-nums;">$${(item.priceAtPurchase * item.quantity).toFixed(2)}</td>
      </tr>`,
    )
    .join('')

  const brand = order.brand ?? DEFAULT_BRAND
  const paymentLabel =
    order.paymentMethod === 'cod'
      ? 'Cash on Delivery'
      : order.paymentMethod === 'card'
        ? 'Card'
        : order.paymentMethod === 'omt'
          ? 'OMT'
          : 'Bank Transfer'
  const bankNote =
    order.paymentMethod === 'bank_transfer'
      ? `<p style="margin: 8px 0 0; font-size: 12px; color: #666; line-height: 1.5;">${
          order.bankInstructions
            ? escapeHtml(order.bankInstructions).replace(/\n/g, '<br>')
            : 'Bank account details will be sent separately via WhatsApp.'
        }</p>`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Order ${order.orderNumber}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

          <!-- Brand header -->
          <tr>
            <td style="padding-bottom:32px;border-bottom:1px solid #1e1e1e;">
              <p style="margin:0;font-size:11px;letter-spacing:0.25em;color:#c9a96e;text-transform:uppercase;">${escapeHtml(brand.storeName)}</p>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding:36px 0 6px;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#f5f0e8;letter-spacing:-0.02em;">Order received</h1>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:28px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:13px;letter-spacing:0.15em;color:#c9a96e;">${order.orderNumber}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding-bottom:32px;border-bottom:1px solid #1e1e1e;">
              <p style="margin:0;font-size:14px;color:#888;line-height:1.7;">Hi ${escapeHtml(order.customerName)},<br><br>${escapeHtml(brand.emailGreeting)}</p>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding-top:28px;">
              <p style="margin:0 0 16px;font-size:10px;letter-spacing:0.2em;color:#444;text-transform:uppercase;">Your Order</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${itemsHtml}
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding:20px 0;border-top:1px solid #1e1e1e;border-bottom:1px solid #1e1e1e;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:12px;color:#555;padding-bottom:6px;">Subtotal</td>
                  <td align="right" style="font-size:12px;color:#555;padding-bottom:6px;font-variant-numeric:tabular-nums;">$${order.subtotal.toFixed(2)}</td>
                </tr>
                ${
                  order.discountAmount && order.discountAmount > 0
                    ? `<tr>
                  <td style="font-size:12px;color:#8a7f6a;padding-bottom:6px;">Discount${order.discountCode ? ` (${escapeHtml(order.discountCode)})` : ''}</td>
                  <td align="right" style="font-size:12px;color:#8a7f6a;padding-bottom:6px;font-variant-numeric:tabular-nums;">&minus;$${order.discountAmount.toFixed(2)}</td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="font-size:12px;color:#555;padding-bottom:6px;">Delivery</td>
                  <td align="right" style="font-size:12px;color:#555;padding-bottom:6px;">${order.deliveryFeeLabel ?? 'Confirmed on call'}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#c0b8ae;font-weight:600;">Total</td>
                  <td align="right" style="font-size:13px;color:#c0b8ae;font-weight:600;font-variant-numeric:tabular-nums;">
                    $${order.total.toFixed(2)}
                    ${
                      order.exchangeRateAtPurchase
                        ? `<br><span style="font-size:11px;color:#666;font-weight:400;">${formatLBP(order.total, order.exchangeRateAtPurchase)}</span>`
                        : ''
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Delivery -->
          <tr>
            <td style="padding-top:24px;padding-bottom:8px;">
              <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.2em;color:#444;text-transform:uppercase;">Delivery</p>
              <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">${escapeHtml(order.area)}<br>${escapeHtml(order.deliveryAddress).replace(/\n/g, '<br>')}</p>
            </td>
          </tr>

          <!-- Payment -->
          <tr>
            <td style="padding-top:20px;padding-bottom:32px;border-bottom:1px solid #1e1e1e;">
              <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.2em;color:#444;text-transform:uppercase;">Payment</p>
              <p style="margin:0;font-size:13px;color:#888;">${paymentLabel}</p>
              ${bankNote}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:32px;">
              <p style="margin:0;font-size:11px;color:#3a3a3a;line-height:1.6;">${escapeHtml(brand.storeName)} — ${escapeHtml(brand.emailFooterNote)}<br>Questions? Reply to this email or WhatsApp us directly.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// --- Status update email ---

export type StatusEmailData = {
  orderNumber: string
  customerName: string
  customerEmail: string
  status: string
  /** Brand voice from SiteSettings → Copy tab. Defaults applied when omitted. */
  brand?: BrandCopy
  /** Shown on the "shipped" email when set (ROADMAP Part 3.2) */
  courierName?: string
  trackingRef?: string
  /** Only needed by sendOrderStatusWhatsApp — the email itself doesn't use it. */
  customerPhone?: string
}

const STATUS_EMAIL_COPY: Record<string, { subject: string; body: string }> = {
  confirmed: {
    subject: 'Order confirmed',
    body: 'Your order is confirmed — we’re getting started on your piece.',
  },
  in_production: {
    subject: 'Your piece is being painted',
    body: 'Your piece is on the easel right now. We’ll let you know the moment it ships.',
  },
  shipped: {
    subject: 'Your order is on its way',
    body: 'Your order has shipped. Keep your phone nearby — the courier will call to arrange delivery.',
  },
  delivered: {
    subject: 'Order delivered',
    body: 'Your order was delivered. Thank you for supporting the music — wear it loud.',
  },
  cancelled: {
    subject: 'Order cancelled',
    body: 'Your order has been cancelled. If this is unexpected, just reply to this email or reach us on WhatsApp.',
  },
}

export async function sendOrderStatusEmail(data: StatusEmailData): Promise<void> {
  const copy = STATUS_EMAIL_COPY[data.status]
  if (!copy || !data.customerEmail) return

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[notifications] RESEND_API_KEY not set — skipping status email')
    return
  }

  const resend = new Resend(apiKey)
  const from = process.env.RESEND_FROM || 'orders@trackid.lb'
  const brand = data.brand ?? DEFAULT_BRAND
  const replyTo = brand.contactEmail

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${copy.subject}</title></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;">
    <tr><td align="center" style="padding:48px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
        <tr><td style="padding-bottom:32px;border-bottom:1px solid #1e1e1e;">
          <p style="margin:0;font-size:11px;letter-spacing:0.25em;color:#c9a96e;text-transform:uppercase;">${escapeHtml(brand.storeName)}</p>
        </td></tr>
        <tr><td style="padding:36px 0 6px;">
          <h1 style="margin:0;font-size:24px;font-weight:700;color:#f5f0e8;letter-spacing:-0.02em;">${copy.subject}</h1>
        </td></tr>
        <tr><td style="padding-bottom:28px;">
          <p style="margin:0;font-family:'Courier New',monospace;font-size:13px;letter-spacing:0.15em;color:#c9a96e;">${escapeHtml(data.orderNumber)}</p>
        </td></tr>
        <tr><td style="padding-bottom:32px;">
          <p style="margin:0;font-size:14px;color:#888;line-height:1.7;">Hi ${escapeHtml(data.customerName)},<br><br>${copy.body}</p>
          ${
            data.status === 'shipped' && (data.courierName || data.trackingRef)
              ? `<p style="margin:16px 0 0;font-size:13px;color:#c9a96e;">${
                  data.courierName ? `Courier: ${escapeHtml(data.courierName)}` : ''
                }${data.courierName && data.trackingRef ? ' · ' : ''}${
                  data.trackingRef ? `Tracking: ${escapeHtml(data.trackingRef)}` : ''
                }</p>`
              : ''
          }
        </td></tr>
        <tr><td style="padding-top:24px;border-top:1px solid #1e1e1e;">
          <p style="margin:0;font-size:11px;color:#3a3a3a;line-height:1.6;">Questions? Reply to this email or WhatsApp us directly.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const { error } = await resend.emails.send({
      from,
      to: data.customerEmail,
      ...(replyTo ? { replyTo } : {}),
      subject: `${copy.subject} — ${data.orderNumber}`,
      html,
    })
    if (error) console.error('[notifications] Resend status email error:', error)
  } catch (err) {
    console.error('[notifications] Failed to send status email:', err)
  }
}

// --- Return status email ---

export type ReturnStatusEmailData = {
  orderNumber: string
  customerName: string
  customerEmail: string
  status: string
  brand?: BrandCopy
}

const RETURN_STATUS_COPY: Record<string, { subject: string; body: string }> = {
  approved: {
    subject: 'Return approved',
    body: 'Your return request has been approved. Ship the item(s) back and we’ll take it from there.',
  },
  received: {
    subject: 'Return received',
    body: 'We’ve received your returned item(s) and are processing them now.',
  },
  refunded: {
    subject: 'Return refunded',
    body: 'Your refund has been processed. It may take a few days to appear, depending on your payment method.',
  },
  rejected: {
    subject: 'Return request declined',
    body: 'Unfortunately we’re unable to accept this return. Reply to this email or reach us on WhatsApp if you have questions.',
  },
}

export async function sendReturnStatusEmail(data: ReturnStatusEmailData): Promise<void> {
  const copy = RETURN_STATUS_COPY[data.status]
  if (!copy || !data.customerEmail) return

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[notifications] RESEND_API_KEY not set — skipping return status email')
    return
  }

  const resend = new Resend(apiKey)
  const from = process.env.RESEND_FROM || 'orders@trackid.lb'
  const brand = data.brand ?? DEFAULT_BRAND
  const replyTo = brand.contactEmail

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${copy.subject}</title></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;">
    <tr><td align="center" style="padding:48px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
        <tr><td style="padding-bottom:32px;border-bottom:1px solid #1e1e1e;">
          <p style="margin:0;font-size:11px;letter-spacing:0.25em;color:#c9a96e;text-transform:uppercase;">${escapeHtml(brand.storeName)}</p>
        </td></tr>
        <tr><td style="padding:36px 0 6px;">
          <h1 style="margin:0;font-size:24px;font-weight:700;color:#f5f0e8;letter-spacing:-0.02em;">${copy.subject}</h1>
        </td></tr>
        <tr><td style="padding-bottom:28px;">
          <p style="margin:0;font-family:'Courier New',monospace;font-size:13px;letter-spacing:0.15em;color:#c9a96e;">${escapeHtml(data.orderNumber)}</p>
        </td></tr>
        <tr><td style="padding-bottom:32px;">
          <p style="margin:0;font-size:14px;color:#888;line-height:1.7;">Hi ${escapeHtml(data.customerName)},<br><br>${copy.body}</p>
        </td></tr>
        <tr><td style="padding-top:24px;border-top:1px solid #1e1e1e;">
          <p style="margin:0;font-size:11px;color:#3a3a3a;line-height:1.6;">Questions? Reply to this email or WhatsApp us directly.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const { error } = await resend.emails.send({
      from,
      to: data.customerEmail,
      ...(replyTo ? { replyTo } : {}),
      subject: `${copy.subject} — ${data.orderNumber}`,
      html,
    })
    if (error) console.error('[notifications] Resend return status email error:', error)
  } catch (err) {
    console.error('[notifications] Failed to send return status email:', err)
  }
}

// --- Low-stock alert ---

export type LowStockAlertData = {
  recipientEmail: string
  brand?: BrandCopy
  products: Array<{ title: string; size?: string; stock: number }>
}

export async function sendLowStockAlertEmail(data: LowStockAlertData): Promise<void> {
  if (!data.recipientEmail || data.products.length === 0) return

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[notifications] RESEND_API_KEY not set — skipping low-stock alert')
    return
  }

  const resend = new Resend(apiKey)
  const from = process.env.RESEND_FROM || 'orders@trackid.lb'
  const brand = data.brand ?? DEFAULT_BRAND

  const rowsHtml = data.products
    .map(
      (p) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #1e1e1e;color:#f5f0e8;">${escapeHtml(p.title)}${
          p.size ? ` <span style="color:#666;">(${escapeHtml(p.size)})</span>` : ''
        }</td><td style="padding:6px 0;border-bottom:1px solid #1e1e1e;text-align:right;color:${
          p.stock === 0 ? '#e07a5f' : '#c9a96e'
        };">${p.stock === 0 ? 'Sold out' : `${p.stock} left`}</td></tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Low stock alert</title></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;">
    <tr><td align="center" style="padding:48px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
        <tr><td style="padding-bottom:32px;border-bottom:1px solid #1e1e1e;">
          <p style="margin:0;font-size:11px;letter-spacing:0.25em;color:#c9a96e;text-transform:uppercase;">${escapeHtml(brand.storeName)}</p>
        </td></tr>
        <tr><td style="padding:36px 0 20px;">
          <h1 style="margin:0;font-size:24px;font-weight:700;color:#f5f0e8;letter-spacing:-0.02em;">Low stock alert</h1>
          <p style="margin:8px 0 0;font-size:13px;color:#888;">${data.products.length} product${data.products.length === 1 ? '' : 's'} at or below threshold</p>
        </td></tr>
        <tr><td style="padding-bottom:32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">${rowsHtml}</table>
        </td></tr>
        <tr><td style="padding-top:24px;border-top:1px solid #1e1e1e;">
          <p style="margin:0;font-size:11px;color:#3a3a3a;line-height:1.6;">Adjust stock or restock from the admin Products list.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const { error } = await resend.emails.send({
      from,
      to: data.recipientEmail,
      subject: `${brand.storeName} — Low stock alert (${data.products.length})`,
      html,
    })
    if (error) console.error('[notifications] Resend low-stock alert error:', error)
  } catch (err) {
    console.error('[notifications] Failed to send low-stock alert:', err)
  }
}

// --- Abandoned-cart recovery ---

export type AbandonedCartEmailData = {
  customerEmail: string
  customerName: string
  items: Array<{ title: string; price: number; quantity: number; size?: string }>
  cartUrl: string
  unsubscribeUrl: string
  brand?: BrandCopy
}

export async function sendAbandonedCartEmail(data: AbandonedCartEmailData): Promise<void> {
  if (!data.customerEmail || data.items.length === 0) return

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[notifications] RESEND_API_KEY not set — skipping abandoned-cart email')
    return
  }

  const resend = new Resend(apiKey)
  const from = process.env.RESEND_FROM || 'orders@trackid.lb'
  const brand = data.brand ?? DEFAULT_BRAND
  const replyTo = brand.contactEmail

  const itemsHtml = data.items
    .map(
      (item) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #1e1e1e;color:#f5f0e8;">${escapeHtml(item.title)}${
          item.size ? ` <span style="color:#666;">(${escapeHtml(item.size)})</span>` : ''
        } × ${item.quantity}</td><td style="padding:6px 0;border-bottom:1px solid #1e1e1e;text-align:right;color:#c9a96e;">$${(item.price * item.quantity).toFixed(2)}</td></tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>You left something behind</title></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;">
    <tr><td align="center" style="padding:48px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
        <tr><td style="padding-bottom:32px;border-bottom:1px solid #1e1e1e;">
          <p style="margin:0;font-size:11px;letter-spacing:0.25em;color:#c9a96e;text-transform:uppercase;">${escapeHtml(brand.storeName)}</p>
        </td></tr>
        <tr><td style="padding:36px 0 6px;">
          <h1 style="margin:0;font-size:24px;font-weight:700;color:#f5f0e8;letter-spacing:-0.02em;">You left something behind</h1>
        </td></tr>
        <tr><td style="padding-bottom:28px;">
          <p style="margin:0;font-size:14px;color:#888;line-height:1.7;">Hi ${escapeHtml(data.customerName)}, your cart is still saved — pick up where you left off.</p>
        </td></tr>
        <tr><td style="padding-bottom:28px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">${itemsHtml}</table>
        </td></tr>
        <tr><td style="padding-bottom:32px;">
          <a href="${data.cartUrl}" style="display:inline-block;background-color:#c9a96e;color:#0a0a0a;padding:12px 28px;font-size:13px;font-weight:600;text-decoration:none;letter-spacing:0.05em;">View your cart</a>
        </td></tr>
        <tr><td style="padding-top:24px;border-top:1px solid #1e1e1e;">
          <p style="margin:0;font-size:11px;color:#3a3a3a;line-height:1.6;">
            <a href="${data.unsubscribeUrl}" style="color:#3a3a3a;">Unsubscribe from cart reminders</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const { error } = await resend.emails.send({
      from,
      to: data.customerEmail,
      ...(replyTo ? { replyTo } : {}),
      subject: `You left something behind — ${brand.storeName}`,
      html,
    })
    if (error) console.error('[notifications] Resend abandoned-cart email error:', error)
  } catch (err) {
    console.error('[notifications] Failed to send abandoned-cart email:', err)
  }
}

// --- Back-in-stock alert ---

export type BackInStockEmailData = {
  email: string
  productTitle: string
  productUrl: string
  brand?: BrandCopy
}

export async function sendBackInStockEmail(data: BackInStockEmailData): Promise<void> {
  if (!data.email) return
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[notifications] RESEND_API_KEY not set — skipping back-in-stock email')
    return
  }

  const resend = new Resend(apiKey)
  const from = process.env.RESEND_FROM || 'orders@trackid.lb'
  const brand = data.brand ?? DEFAULT_BRAND

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Back in stock</title></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;">
    <tr><td align="center" style="padding:48px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
        <tr><td style="padding-bottom:32px;border-bottom:1px solid #1e1e1e;">
          <p style="margin:0;font-size:11px;letter-spacing:0.25em;color:#c9a96e;text-transform:uppercase;">${escapeHtml(brand.storeName)}</p>
        </td></tr>
        <tr><td style="padding:36px 0 6px;">
          <h1 style="margin:0;font-size:24px;font-weight:700;color:#f5f0e8;letter-spacing:-0.02em;">Back in stock</h1>
        </td></tr>
        <tr><td style="padding-bottom:28px;">
          <p style="margin:0;font-size:14px;color:#888;line-height:1.7;">${escapeHtml(data.productTitle)} is back — grab it before it's gone again.</p>
        </td></tr>
        <tr><td style="padding-bottom:32px;">
          <a href="${data.productUrl}" style="display:inline-block;background-color:#c9a96e;color:#0a0a0a;padding:12px 28px;font-size:13px;font-weight:600;text-decoration:none;letter-spacing:0.05em;">Shop now</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const { error } = await resend.emails.send({
      from,
      to: data.email,
      subject: `Back in stock — ${data.productTitle}`,
      html,
    })
    if (error) console.error('[notifications] Resend back-in-stock email error:', error)
  } catch (err) {
    console.error('[notifications] Failed to send back-in-stock email:', err)
  }
}

// --- Account ---

export type PasswordResetEmailData = {
  customerEmail: string
  customerName: string
  resetUrl: string
  /** Brand voice from SiteSettings → Copy tab. Defaults applied when omitted. */
  brand?: BrandCopy
}

export async function sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[notifications] RESEND_API_KEY not set — skipping password reset email')
    return
  }

  const resend = new Resend(apiKey)
  const from = process.env.RESEND_FROM || 'orders@trackid.lb'
  const brand = data.brand ?? DEFAULT_BRAND
  const replyTo = brand.contactEmail

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reset your password</title></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;">
    <tr><td align="center" style="padding:48px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
        <tr><td style="padding-bottom:32px;border-bottom:1px solid #1e1e1e;">
          <p style="margin:0;font-size:11px;letter-spacing:0.25em;color:#c9a96e;text-transform:uppercase;">${escapeHtml(brand.storeName)}</p>
        </td></tr>
        <tr><td style="padding:36px 0 6px;">
          <h1 style="margin:0;font-size:24px;font-weight:700;color:#f5f0e8;letter-spacing:-0.02em;">Reset your password</h1>
        </td></tr>
        <tr><td style="padding-bottom:28px;">
          <p style="margin:0;font-size:14px;color:#888;line-height:1.7;">Hi ${escapeHtml(data.customerName)},<br><br>We received a request to reset your password. This link expires in 30 minutes and can only be used once.</p>
        </td></tr>
        <tr><td style="padding-bottom:28px;">
          <a href="${data.resetUrl}" style="display:inline-block;background-color:#c9a96e;color:#0a0a0a;text-decoration:none;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;padding:12px 24px;">Reset password</a>
        </td></tr>
        <tr><td style="padding-top:24px;border-top:1px solid #1e1e1e;">
          <p style="margin:0;font-size:11px;color:#3a3a3a;line-height:1.6;">Didn't request this? You can safely ignore this email — your password will not change.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const { error } = await resend.emails.send({
      from,
      to: data.customerEmail,
      ...(replyTo ? { replyTo } : {}),
      subject: 'Reset your password',
      html,
    })
    if (error) console.error('[notifications] Resend password reset error:', error)
  } catch (err) {
    console.error('[notifications] Failed to send password reset email:', err)
  }
}

// --- WhatsApp ---

// Staff new-order alert. Was a plain free-text message — that only works
// while the recipient happens to have an open 24h WhatsApp "customer service
// window" with the business number (e.g. having just messaged it), which
// isn't a fair assumption for an alert meant to fire on every single order
// (confirmed the failure for real: Meta error 131047 "Re-engagement
// message" the first time this was tested against a genuinely stale
// window). Converted to an approved template, same reasoning
// sendOrderStatusWhatsApp already uses below. Deliberately kept SHORT (order
// number, customer name, total) rather than trying to cram the full
// itemized order into template variables — long/complex bodies are harder
// to get approved and templates aren't meant to replace the admin's own
// order detail view, which already has everything.
//
// Expected template (submit for approval in Meta Business Manager, category
// "Utility"): body text with three variables, e.g.
//   "New order {{1}} from {{2}} — total ${{3}}. Check the admin dashboard for full details."
// {{1}} = order number, {{2}} = customer name, {{3}} = total (2 decimals)
export async function sendOrderWhatsAppAlert(order: OrderNotificationData): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const recipient = process.env.WHATSAPP_RECIPIENT_NUMBER
  const templateName = process.env.WHATSAPP_ORDER_ALERT_TEMPLATE_NAME
  const templateLang = process.env.WHATSAPP_ORDER_ALERT_TEMPLATE_LANG || 'en'

  if (!token || !phoneNumberId || !recipient || !templateName) {
    // Not an error — fully optional until the business has both API keys
    // AND an approved template, same convention as every other optional
    // integration in this codebase.
    return
  }

  // Meta API requires number without leading +
  const to = recipient.replace(/^\+/, '')

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLang },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: order.orderNumber },
                { type: 'text', text: order.customerName },
                { type: 'text', text: order.total.toFixed(2) },
              ],
            },
          ],
        },
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[notifications] WhatsApp order-alert template error:', text)
    }
  } catch (err) {
    console.error('[notifications] Failed to send WhatsApp alert:', err)
  }
}

// Order-confirmation WhatsApp message to the CUSTOMER, fired at the same
// moment as sendOrderConfirmationEmail (immediately for COD/bank-transfer,
// deferred to the payment-confirmed hook for card/OMT — see both call
// sites). Same 24h-window reasoning as the staff alert above and as
// sendOrderStatusWhatsApp below — a first-time customer has essentially
// never messaged the business first, so this MUST be a template.
//
// Expected template (submit for approval in Meta Business Manager, category
// "Utility"): body text with three variables, e.g.
//   "Hi {{1}}, thank you for your order! We've received order {{2}} — total ${{3}} — and it's being processed. We'll message you here with updates."
// {{1}} = customer name, {{2}} = order number, {{3}} = total (2 decimals)
export async function sendOrderConfirmationWhatsApp(order: OrderNotificationData): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const templateName = process.env.WHATSAPP_ORDER_CONFIRMATION_TEMPLATE_NAME
  const templateLang = process.env.WHATSAPP_ORDER_CONFIRMATION_TEMPLATE_LANG || 'en'

  if (!token || !phoneNumberId || !templateName) return

  const to = order.customerPhone.replace(/[^\d+]/g, '').replace(/^\+/, '')
  if (!to) return

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLang },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: order.customerName },
                { type: 'text', text: order.orderNumber },
                { type: 'text', text: order.total.toFixed(2) },
              ],
            },
          ],
        },
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[notifications] WhatsApp order-confirmation template error:', text)
    }
  } catch (err) {
    console.error('[notifications] Failed to send WhatsApp order confirmation:', err)
  }
}

// Order-status WhatsApp messages to the CUSTOMER (ROADMAP Part 7 — distinct
// from sendOrderWhatsAppAlert above, which pings the TEAM's fixed number on
// every new order). This one is business-initiated and proactive — the
// customer hasn't necessarily messaged first, so it's outside WhatsApp's
// 24-hour "customer service window" and Meta's Cloud API will reject a plain
// free-text message to them. It MUST use a pre-approved message template
// (`type: 'template'`), which needs to be created and approved in Meta
// Business Manager before this can send anything for real — a business
// process step, not a code one. WHATSAPP_STATUS_TEMPLATE_NAME documents the
// expected template shape below and gates this on/off; unset (the default)
// means this function is a silent no-op, same convention as every other
// optional integration in this codebase.
//
// Expected template (submit for approval in Meta Business Manager, category
// "Utility"): body text with two variables, e.g.
//   "Update on your order {{1}}: {{2}}."
// {{1}} = order number, {{2}} = the same human status label the status email
// uses (STATUS_EMAIL_COPY[status].subject) — kept in sync automatically since
// both read from the same map.
export async function sendOrderStatusWhatsApp(data: StatusEmailData): Promise<void> {
  const copy = STATUS_EMAIL_COPY[data.status]
  if (!copy || !data.customerPhone) return

  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const templateName = process.env.WHATSAPP_STATUS_TEMPLATE_NAME
  const templateLang = process.env.WHATSAPP_STATUS_TEMPLATE_LANG || 'en'

  if (!token || !phoneNumberId || !templateName) {
    // Not an error — this integration is fully optional until the business
    // has both API keys AND an approved template.
    return
  }

  const to = data.customerPhone.replace(/[^\d+]/g, '').replace(/^\+/, '')
  if (!to) return

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLang },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: data.orderNumber }, { type: 'text', text: copy.subject }],
            },
          ],
        },
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('[notifications] WhatsApp status template error:', text)
    }
  } catch (err) {
    console.error('[notifications] Failed to send WhatsApp status message:', err)
  }
}
