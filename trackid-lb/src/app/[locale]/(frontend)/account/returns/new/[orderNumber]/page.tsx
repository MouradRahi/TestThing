import { redirect, notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { getPayload } from '@/lib/payload'
import { getCustomer } from '@/lib/auth'
import { ReturnRequestForm } from '@/components/account/ReturnRequestForm'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ locale: string; orderNumber: string }> }

export default async function NewReturnPage({ params }: Props) {
  const { orderNumber } = await params
  const [auth, locale] = await Promise.all([getCustomer(), getLocale()])
  if (!auth) redirect(locale === 'en' ? '/account/login' : `/${locale}/account/login`)

  const payload = await getPayload()
  const t = await getTranslations('returns')

  const { docs } = await payload.find({
    collection: 'orders',
    where: { orderNumber: { equals: orderNumber } },
    limit: 1,
    depth: 0,
  })
  const order = docs[0]
  if (!order) notFound()

  const orderCustomerId = typeof order.customer === 'object' ? (order.customer as { id: number })?.id : order.customer
  if (!orderCustomerId || String(orderCustomerId) !== String(auth.id)) notFound()
  if (order.orderStatus !== 'delivered') notFound()

  const items: Array<{
    productId: string
    titleAtPurchase: string
    size?: string | null
    priceAtPurchase: number
    quantity: number
  }> = Array.isArray(order.items) ? order.items : []

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold text-foreground mb-2">{t('requestReturn')}</h1>
      <p className="font-mono text-accent text-sm tracking-wider mb-10">{order.orderNumber}</p>
      <ReturnRequestForm orderId={Number(order.id)} items={items} />
    </div>
  )
}
