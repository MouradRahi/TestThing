import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { getPayload } from '@/lib/payload'
import { getSiteSettings, getDeliveryZones, DEFAULT_ORDER_THANKYOU_NOTE } from '@/lib/site-settings'
import { formatPrice, formatLBP } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { PaymentConfirmingBanner } from '@/components/payments/PaymentConfirmingBanner'

// Always render fresh: customers revisit this page (and arrive via /track) to
// see their live order status — a cached copy would freeze it at first view.
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ locale: string; orderNumber: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'order' })
  return { title: t('metaTitle') }
}

export default async function OrderConfirmationPage({ params }: Props) {
  const { orderNumber } = await params
  const t = await getTranslations('order')
  const tPayment = await getTranslations('payment')
  const payload = await getPayload()

  const { docs } = await payload.find({
    collection: 'orders',
    where: { orderNumber: { equals: orderNumber } },
    limit: 1,
    depth: 0,
  })
  const order = docs[0]
  if (!order) notFound()

  const isOmtPayment = order.paymentMethod === 'omt'
  let omtVoucherCode: string | null = null
  if (isOmtPayment) {
    const { docs: paymentDocs } = await payload.find({
      collection: 'payments',
      where: { order: { equals: order.id } },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
    })
    omtVoucherCode = (paymentDocs[0]?.providerRef as string) || null
  }

  const items: Array<{
    titleAtPurchase: string
    priceAtPurchase: number
    quantity: number
    size?: string | null
    imageUrl?: string | null
  }> = Array.isArray(order.items) ? order.items : []

  const isBankTransfer = order.paymentMethod === 'bank_transfer'
  const isCardPayment = order.paymentMethod === 'card'
  const paymentLabel = isCardPayment ? t('card') : isOmtPayment ? t('omt') : isBankTransfer ? t('bankTransfer') : t('cod')
  const settings = await getSiteSettings(await getLocale())
  const bankInstructions = (settings.bankTransferInstructions as string) || ''
  const omtInstructions = (settings.omtInstructions as string) || ''
  const thankYouNote = (settings.orderThankYouNote as string) || DEFAULT_ORDER_THANKYOU_NOTE
  // A 0 fee only means "free" when zones are configured; otherwise the fee is
  // simply unknown and gets confirmed by phone (matches checkout + email copy).
  const zonesConfigured = getDeliveryZones(settings).length > 0

  return (
    <div className="max-w-2xl mx-auto px-6 py-20">
      {isCardPayment && (
        <PaymentConfirmingBanner orderNumber={order.orderNumber as string} initialStatus={String(order.paymentStatus)} />
      )}
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
                {formatPrice(item.priceAtPurchase * item.quantity)}
              </p>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-4 space-y-2 text-xs">
          <div className="flex justify-between text-muted">
            <span>{t('subtotal')}</span>
            <span className="tabular-nums">{formatPrice(Number(order.subtotal))}</span>
          </div>
          {Number(order.discountAmount) > 0 && (
            <div className="flex justify-between text-accent">
              <span>{t('discount')}{order.discountCode ? ` (${order.discountCode})` : ''}</span>
              <span className="tabular-nums">−{formatPrice(Number(order.discountAmount))}</span>
            </div>
          )}
          <div className="flex justify-between text-muted">
            <span>{t('delivery')}</span>
            <span className="tabular-nums">
              {Number(order.deliveryFee) > 0
                ? formatPrice(Number(order.deliveryFee))
                : zonesConfigured
                  ? t('deliveryFree')
                  : t('deliveryByPhone')}
            </span>
          </div>
          <div className="flex justify-between items-baseline text-foreground font-semibold pt-2 border-t border-border text-sm">
            <span>{t('total')}</span>
            <span className="text-end">
              <span className="tabular-nums">{formatPrice(Number(order.total))}</span>
              {/* Snapshotted at purchase time — a later admin rate change never
                  retroactively changes what a past order "was worth" (F1 §2.5). */}
              {typeof order.exchangeRateAtPurchase === 'number' && (
                <span className="block text-[10px] font-normal text-muted tabular-nums">
                  {formatLBP(Number(order.total), order.exchangeRateAtPurchase)}
                </span>
              )}
            </span>
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
          <p className="text-foreground">{paymentLabel}</p>
        </div>
        {(order.courierName || order.trackingRef) && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted mb-1.5">{t('courier')}</p>
            {order.courierName && <p className="text-foreground">{order.courierName}</p>}
            {order.trackingRef && (
              <p className="text-muted mt-0.5">
                {t('trackingRef')}: <span className="font-mono">{order.trackingRef}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bank transfer instructions */}
      {isBankTransfer && bankInstructions && (
        <div className="border border-accent/30 bg-surface p-6 mb-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent mb-3">{t('howToPay')}</p>
          <p className="text-xs text-muted leading-relaxed whitespace-pre-line">{bankInstructions}</p>
        </div>
      )}

      {/* OMT voucher — code + instructions while awaiting payment; a short
          status note once resolved (no live polling — this can take hours). */}
      {isOmtPayment && omtVoucherCode && (
        <div className="border border-accent/30 bg-surface p-6 mb-6">
          {order.paymentStatus === 'awaiting_payment' && (
            <>
              <p className="text-[10px] uppercase tracking-[0.2em] text-accent mb-3">{t('howToPay')}</p>
              <p className="font-mono text-lg text-foreground tracking-wider mb-3">{omtVoucherCode}</p>
              {omtInstructions && (
                <p className="text-xs text-muted leading-relaxed whitespace-pre-line">{omtInstructions}</p>
              )}
            </>
          )}
          {order.paymentStatus === 'paid' && (
            <p className="text-xs text-muted leading-relaxed">
              {t('omtPaid')} <span className="font-mono text-foreground">{omtVoucherCode}</span>
            </p>
          )}
          {order.paymentStatus === 'failed' && (
            <p className="text-xs text-red-400 leading-relaxed">{tPayment('failedBody')}</p>
          )}
          {order.paymentStatus === 'expired' && (
            <p className="text-xs text-red-400 leading-relaxed">{tPayment('expiredBody')}</p>
          )}
        </div>
      )}

      <div className="text-center pt-6 flex flex-col items-center gap-3">
        <Button href="/shop" variant="secondary">{t('continueShopping')}</Button>
        <a
          href={`/api/invoices/${order.orderNumber}`}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] uppercase tracking-widest text-accent hover:text-accent-hover transition-colors"
        >
          {t('downloadInvoice')}
        </a>
      </div>
    </div>
  )
}
