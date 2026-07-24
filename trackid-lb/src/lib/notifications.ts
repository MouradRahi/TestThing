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
  paymentMethod: 'cod' | 'bank_transfer' | 'card'
  /** e.g. "Free" or "$4.00" — omitted when no delivery zones are configured */
  deliveryFeeLabel?: string
  /** LBP-per-USD rate snapshotted at purchase (ROADMAP F1 §2.5) — omitted when currency display is USD-only. */
  exchangeRateAtPurchase?: number
  /** Bank transfer payment details from SiteSettings, only set for bank_transfer orders */
  bankInstructions?: string
  /** Brand voice from SiteSettings → Copy tab. Defaults applied when omitted. */
  brand?: BrandCopy
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
    order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod === 'card' ? 'Card' : 'Bank Transfer'
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

export async function sendOrderWhatsAppAlert(order: OrderNotificationData): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const recipient = process.env.WHATSAPP_RECIPIENT_NUMBER

  if (!token || !phoneNumberId || !recipient) {
    console.warn('[notifications] WhatsApp env vars not set — skipping team alert')
    return
  }

  // Meta API requires number without leading +
  const to = recipient.replace(/^\+/, '')

  const itemsList = order.items
    .map((i) => `• ${i.titleAtPurchase}${i.size ? ` (${i.size})` : ''} ×${i.quantity} — $${(i.priceAtPurchase * i.quantity).toFixed(2)}`)
    .join('\n')

  const paymentLabel =
    order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod === 'card' ? 'Card' : 'Bank Transfer'

  const body = [
    `🛍 New Order — ${order.orderNumber}`,
    '',
    `Customer: ${order.customerName}`,
    `Phone: ${order.customerPhone}`,
    `Area: ${order.area}`,
    '',
    'Items:',
    itemsList,
    '',
    `Subtotal: $${order.subtotal.toFixed(2)}`,
    ...(order.discountAmount && order.discountAmount > 0
      ? [`Discount${order.discountCode ? ` (${order.discountCode})` : ''}: -$${order.discountAmount.toFixed(2)}`]
      : []),
    ...(order.deliveryFeeLabel ? [`Delivery: ${order.deliveryFeeLabel}`] : []),
    `Total: $${order.total.toFixed(2)}`,
    `Payment: ${paymentLabel}`,
  ].join('\n')

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
        type: 'text',
        text: { body },
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[notifications] WhatsApp API error:', text)
    }
  } catch (err) {
    console.error('[notifications] Failed to send WhatsApp alert:', err)
  }
}
