import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { resolveBrandCopy, resolveVatConfig } from '@/lib/site-settings'
import { generateInvoicePdf, type InvoiceItem } from '@/lib/invoices/invoice-pdf'

// Public by design, same trust model as /order/[orderNumber] (ROADMAP Part
// 3.1): the order confirmation page has never required login — knowledge of
// the orderNumber (a random TRK-<timestamp>-<random> suffix, not a guessable
// sequential id) is the access control, exactly like every other order-scoped
// customer-facing surface in this app. Generated live from the order's own
// snapshotted items/prices, so it always reflects what was actually charged.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params
  const payload = await getPayload()

  const { docs } = await payload.find({
    collection: 'orders',
    where: { orderNumber: { equals: orderNumber } },
    limit: 1,
    depth: 0,
  })
  const order = docs[0]
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const settings = (await payload.findGlobal({ slug: 'site-settings' })) as unknown as Record<string, unknown>
  const brand = resolveBrandCopy(settings)
  const vat = resolveVatConfig(settings)

  const items: InvoiceItem[] = Array.isArray(order.items)
    ? order.items.map((item) => ({
        titleAtPurchase: item.titleAtPurchase,
        size: item.size,
        priceAtPurchase: item.priceAtPurchase,
        quantity: item.quantity,
      }))
    : []

  const buf = await generateInvoicePdf({
    orderNumber: order.orderNumber as string,
    createdAt: order.createdAt as string,
    customerName: order.customerName as string,
    customerEmail: order.customerEmail,
    deliveryAddress: order.deliveryAddress as string,
    area: order.area as string,
    items,
    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.deliveryFee) || 0,
    discountAmount: Number(order.discountAmount) > 0 ? Number(order.discountAmount) : undefined,
    discountCode: order.discountCode ?? undefined,
    total: Number(order.total),
    storeName: brand.storeName,
    contactEmail: brand.contactEmail,
    vat: vat.enabled ? { rate: vat.rate, registrationNumber: vat.registrationNumber } : undefined,
  })

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${orderNumber}.pdf"`,
    },
  })
}
