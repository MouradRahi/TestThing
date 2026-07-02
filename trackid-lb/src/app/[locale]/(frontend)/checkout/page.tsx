import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { getSiteSettings, getDeliveryZones } from '@/lib/site-settings'
import { getCustomer } from '@/lib/auth'
import { CheckoutForm } from '@/components/checkout/CheckoutForm'

export const metadata: Metadata = { title: 'Checkout' }
export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const locale = await getLocale()
  const [settings, customer] = await Promise.all([getSiteSettings(locale), getCustomer()])

  const prefill = customer
    ? {
        name: customer.name ?? '',
        phone: customer.phone ?? '',
        email: customer.email ?? '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        addresses: (Array.isArray(customer.addresses) ? customer.addresses : []) as any[],
      }
    : undefined

  return (
    <CheckoutForm
      zones={getDeliveryZones(settings)}
      freeDeliveryThreshold={
        typeof settings.freeDeliveryThreshold === 'number' ? settings.freeDeliveryThreshold : null
      }
      bankTransferInstructions={(settings.bankTransferInstructions as string) || ''}
      prefill={prefill}
    />
  )
}
