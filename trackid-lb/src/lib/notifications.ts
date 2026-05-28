import { Resend } from 'resend'

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
  }>
  subtotal: number
  total: number
  paymentMethod: 'cod' | 'bank_transfer'
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

  try {
    const { error } = await resend.emails.send({
      from,
      to: order.customerEmail,
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
        <td style="padding: 10px 0; border-bottom: 1px solid #1a1a1a; font-size: 13px; color: #c0b8ae;">${item.titleAtPurchase}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #1a1a1a; font-size: 13px; color: #666; text-align: center;">×${item.quantity}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #1a1a1a; font-size: 13px; color: #c0b8ae; text-align: right; font-variant-numeric: tabular-nums;">$${(item.priceAtPurchase * item.quantity).toFixed(2)}</td>
      </tr>`,
    )
    .join('')

  const paymentLabel = order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Bank Transfer'
  const bankNote =
    order.paymentMethod === 'bank_transfer'
      ? `<p style="margin: 8px 0 0; font-size: 12px; color: #666; line-height: 1.5;">Bank account details will be sent separately via WhatsApp.</p>`
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
              <p style="margin:0;font-size:11px;letter-spacing:0.25em;color:#c9a96e;text-transform:uppercase;">TRACKID.LB</p>
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
              <p style="margin:0;font-size:14px;color:#888;line-height:1.7;">Hi ${order.customerName},<br><br>Thank you for supporting the music. Our team will reach out on WhatsApp to confirm your delivery details and arrange handoff.</p>
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
                <tr>
                  <td style="font-size:12px;color:#555;">Delivery</td>
                  <td align="right" style="font-size:12px;color:#555;">Confirmed on call</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Delivery -->
          <tr>
            <td style="padding-top:24px;padding-bottom:8px;">
              <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.2em;color:#444;text-transform:uppercase;">Delivery</p>
              <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">${order.area}<br>${order.deliveryAddress.replace(/\n/g, '<br>')}</p>
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
              <p style="margin:0;font-size:11px;color:#3a3a3a;line-height:1.6;">trackID.lb — Lebanon's music fashion brand.<br>Questions? Reply to this email or WhatsApp us directly.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
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
    .map((i) => `• ${i.titleAtPurchase} ×${i.quantity} — $${(i.priceAtPurchase * i.quantity).toFixed(2)}`)
    .join('\n')

  const paymentLabel = order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Bank Transfer'

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
