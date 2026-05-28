import { getPayload } from '@/lib/payload'
import { sendOrderConfirmationEmail, sendOrderWhatsAppAlert } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'

function generateOrderNumber(): string {
  // 6-digit ms timestamp tail + 4 random alphanumeric chars — no module state,
  // collision-safe across cold starts and concurrent Vercel instances
  const ts = Date.now().toString().slice(-6)
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `TRK-${ts}-${rand}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { customerName, customerPhone, customerEmail, deliveryAddress, area, items, notes, paymentMethod } = body

    if (!customerName || !customerPhone || !deliveryAddress || !area || !items?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const subtotal = items.reduce(
      (sum: number, item: { priceAtPurchase: number; quantity: number }) =>
        sum + item.priceAtPurchase * item.quantity,
      0,
    )
    const deliveryFee = 0 // set delivery fee logic here later
    const total = subtotal + deliveryFee

    const payload = await getPayload()

    const order = await payload.create({
      collection: 'orders',
      data: {
        orderNumber: generateOrderNumber(),
        customerName,
        customerPhone,
        customerEmail,
        deliveryAddress,
        area,
        items,
        subtotal,
        deliveryFee,
        total,
        paymentMethod: paymentMethod || 'cod',
        paymentStatus: 'pending',
        orderStatus: 'pending',
        notes,
      },
    })

    const notificationData = {
      orderId: String(order.id),
      orderNumber: order.orderNumber,
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      area,
      items,
      subtotal,
      total,
      paymentMethod: (paymentMethod || 'cod') as 'cod' | 'bank_transfer',
    }

    // Fire-and-forget — notifications must never block the order response
    void sendOrderConfirmationEmail(notificationData)
    void sendOrderWhatsAppAlert(notificationData)

    return NextResponse.json({ orderId: order.id, orderNumber: order.orderNumber }, { status: 201 })
  } catch (err) {
    console.error('Order creation failed:', err)
    return NextResponse.json({ error: 'Order creation failed' }, { status: 500 })
  }
}
