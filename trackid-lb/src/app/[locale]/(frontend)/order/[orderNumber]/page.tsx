import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { getPayload } from '@/lib/payload'
import { getSiteSettings, DEFAULT_ORDER_THANKYOU_NOTE } from '@/lib/site-settings'
import { Button } from '@/components/ui/Button'

export const metadata: Metadata = { title: 'Order Confirmed' }

type Props = { params: Promise<{ orderNumber: string }> }

export default async function OrderConfirmationPage({ params }: Props) {
  const { orderNumber } = await params
  const t = await getTranslations('order')
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
  const settings = await getSiteSettings(await getLocale())
  const bankInstructions = (settings.bankTransferInstructions as string) || ''
  const thankYouNote = (settings.orderThankYouNote as string) || DEFAULT_ORDER_THANKYOU_NOTE

  return (
    <div className="max-w-2xl mx-auto px-6 py-20">
      {/* Header */}
      <div className="text-center mb-14">
        <div className="w-12 h-12 border border-accent/50 rounded-full flex items-center justify-center mx-auto mb-8 text-accent text-xl">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">{t('received')}</h1>
        <p className="font-mono text-accent text-base tracking-wider mb-4">{order.orderNumber}</p>
        <p className="text-xs text-muted leading-relaxed max-w-xs mx-auto whitespace-pre-line">
          {thankYouNote}
        </p>
      </div>

      {/* Items */}
      <div className="border border-border bg-surface p-6 space-y-6 mb-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted">{t('yourOrder')}</p>
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
            <span>{t('subtotal')}</span>
            <span className="tabular-nums">${Number(order.subtotal).toFixed(2)}</span>
          </div>
          {Number(order.discountAmount) > 0 && (
            <div className="flex justify-between text-accent">
              <span>{t('discount')}{order.discountCode ? ` (${order.discountCode})` : ''}</span>
              <span className="tabular-nums">−${Number(order.discountAmount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted">
            <span>{t('delivery')}</span>
            <span className="tabular-nums">
              {Number(order.deliveryFee) > 0 ? `$${Number(order.deliveryFee).toFixed(2)}` : t('deliveryFree')}
            </span>
          </div>
          <div className="flex justify-between text-foreground font-semibold pt-2 border-t border-border text-sm">
            <span>{t('total')}</span>
            <span className="tabular-nums">${Number(order.total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Delivery + payment details */}
      <div className="border border-border p-6 space-y-5 text-xs mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted mb-1.5">{t('status')}</p>
          <p className="text-foreground">{t(`statuses.${order.orderStatus as string}`)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted mb-1.5">{t('delivery')}</p>
          <p className="text-foreground">{order.area}</p>
          <p className="text-muted whitespace-pre-line mt-0.5">{order.deliveryAddress}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted mb-1.5">{t('payment')}</p>
          <p className="text-foreground">{isBankTransfer ? t('bankTransfer') : t('cod')}</p>
        </div>
      </div>

      {/* Bank transfer instructions */}
      {isBankTransfer && bankInstructions && (
        <div className="border border-accent/30 bg-surface p-6 mb-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent mb-3">{t('howToPay')}</p>
          <p className="text-xs text-muted leading-relaxed whitespace-pre-line">{bankInstructions}</p>
        </div>
      )}

      <div className="text-center pt-6">
        <Button href="/shop" variant="secondary">{t('continueShopping')}</Button>
      </div>
    </div>
  )
}
