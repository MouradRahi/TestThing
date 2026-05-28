import { getPayload } from '@/lib/payload'
import { NextRequest, NextResponse } from 'next/server'

let orderCounter = 0

function generateOrderNumber(): string {
  orderCounter++
  const timestamp = Date.now().toString().slice(-4)
  return `TRK-${timestamp}${String(orderCounter).padStart(3, '0')}`
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

    // TODO Phase 3: send confirmation email via Resend
    // TODO Phase 3: send WhatsApp notification to team

    return NextResponse.json({ orderId: order.id, orderNumber: order.orderNumber }, { status: 201 })
  } catch (err) {
    console.error('Order creation failed:', err)
    return NextResponse.json({ error: 'Order creation failed' }, { status: 500 })
  }
}
