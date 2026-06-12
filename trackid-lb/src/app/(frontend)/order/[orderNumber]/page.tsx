import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getPayload } from '@/lib/payload'
import { getSiteSettings } from '@/lib/site-settings'
import { Button } from '@/components/ui/Button'

export const metadata: Metadata = { title: 'Order Confirmed' }

type Props = { params: Promise<{ orderNumber: string }> }

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending confirmation',
  confirmed: 'Confirmed',
  in_production: 'In production',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export default async function OrderConfirmationPage({ params }: Props) {
  const { orderNumber } = await params
  const payload = await getPayload()

  const { docs } = await payload.find({
    collection: 'orders',
    where: { orderNumber: { equals: orderNumber } },
    limit: 1,
    depth: 0,
  })
  const order = docs[0]
  if (!order) notFound()

  const items: Array<{
    titleAtPurchase: string
    priceAtPurchase: number
    quantity: number
    size?: string | null
    imageUrl?: string | null
  }> = Array.isArray(order.items) ? order.items : []

  const isBankTransfer = order.paymentMethod === 'bank_transfer'
  const settings = isBankTransfer ? await getSiteSettings() : {}
  const bankInstructions = (settings.bankTransferInstructions as string) || ''

  return (
    <div className="max-w-2xl mx-auto px-6 py-20">
      {/* Header */}
      <div className="text-center mb-14">
        <div className="w-12 h-12 border border-accent/50 rounded-full flex items-center justify-center mx-auto mb-8 text-accent text-xl">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">Order received</h1>
        <p className="font-mono text-accent text-base tracking-wider mb-4">{order.orderNumber}</p>
        <p className="text-xs text-muted leading-relaxed max-w-xs mx-auto">
          Our team will reach out shortly to confirm your delivery details. Keep your phone nearby.
        </p>
      </div>

      {/* Items */}
      <div className="border border-border bg-surface p-6 space-y-6 mb-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Your Order</p>
        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-14 h-16 bg-bg border border-border shrink-0 relative overflow-hidden">
                {item.imageUrl && (
                  <Image src={item.imageUrl} alt={item.titleAtPurchase} fill className="object-cover" sizes="56px" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground leading-snug">{item.titleAtPurchase}</p>
                <p className="text-[10px] text-muted mt-0.5">
                  {item.size ? `${item.size} · ` : ''}× {item.quantity}
                </p>
              </div>
              <p className="text-xs text-foreground tabular-nums whitespace-nowrap">
                ${(item.priceAtPurchase * item.quantity).toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-4 space-y-2 text-xs">
          <div className="flex justify-between text-muted">
            <span>Subtotal</span>
            <span className="tabular-nums">${Number(order.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Delivery</span>
            <span className="tabular-nums">
              {Number(order.deliveryFee) > 0 ? `$${Number(order.deliveryFee).toFixed(2)}` : 'Free / confirmed by phone'}
            </span>
          </div>
          <div className="flex justify-between text-foreground font-semibold pt-2 border-t border-border text-sm">
            <span>Total</span>
            <span className="tabular-nums">${Number(order.total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Delivery + payment details */}
      <div className="border border-border p-6 space-y-5 text-xs mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted mb-1.5">Status</p>
          <p className="text-foreground">{STATUS_LABELS[order.orderStatus as string] ?? order.orderStatus}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted mb-1.5">Delivery</p>
          <p className="text-foreground">{order.area}</p>
          <p className="text-muted whitespace-pre-line mt-0.5">{order.deliveryAddress}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted mb-1.5">Payment</p>
          <p className="text-foreground">{isBankTransfer ? 'Bank Transfer' : 'Cash on Delivery'}</p>
        </div>
      </div>

      {/* Bank transfer instructions */}
      {isBankTransfer && bankInstructions && (
        <div className="border border-accent/30 bg-surface p-6 mb-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent mb-3">How to pay</p>
          <p className="text-xs text-muted leading-relaxed whitespace-pre-line">{bankInstructions}</p>
        </div>
      )}

      <div className="text-center pt-6">
        <Button href="/shop" variant="secondary">Continue Shopping</Button>
      </div>
    </div>
  )
}
