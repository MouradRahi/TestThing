import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from '@/lib/payload'
import { mockPaymentsAllowed } from '@/lib/payments/mock'
import { MockPayForm } from '@/components/payments/MockPayForm'

export const metadata: Metadata = { title: 'Test payment', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ locale: string; paymentId: string }> }

// Testing-only simulated checkout page for the mock provider (ROADMAP F1
// §2.1/2.3) — stands in for a real gateway's hosted-checkout page until a
// vendor (Areeba/NetCommerce) is onboarded. Guarded off entirely in
// production unless ALLOW_MOCK_PAYMENTS=true, same gate as the adapter and
// its webhook/simulate routes.
export default async function MockPayPage({ params }: Props) {
  if (!mockPaymentsAllowed()) notFound()

  const { locale, paymentId } = await params
  const payload = await getPayload()
  const { docs } = await payload.find({
    collection: 'payments',
    where: { providerRef: { equals: paymentId }, provider: { equals: 'mock' } },
    limit: 1,
    depth: 0,
  })
  const payment = docs[0]
  if (!payment) notFound()

  const orderId = payment.order as string | number
  const { docs: orderDocs } = await payload.find({
    collection: 'orders',
    where: { id: { equals: orderId } },
    limit: 1,
    depth: 0,
  })
  const order = orderDocs[0]
  if (!order) notFound()

  // Already settled (a stale link, a double-click, a back-button visit) —
  // send them straight to the confirmation page instead of re-showing the
  // pay form for a payment that's already done.
  if (payment.status !== 'initiated') {
    redirect(locale === 'en' ? `/order/${order.orderNumber}` : `/${locale}/order/${order.orderNumber}`)
  }

  return (
    <MockPayForm providerRef={payment.providerRef} orderNumber={order.orderNumber as string} amount={payment.amount as number} />
  )
}
