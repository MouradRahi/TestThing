import type { Metadata } from 'next'
import { getSiteSettings, getDeliveryZones } from '@/lib/site-settings'
import { CheckoutForm } from '@/components/checkout/CheckoutForm'

export const metadata: Metadata = { title: 'Checkout' }

export default async function CheckoutPage() {
  const settings = await getSiteSettings()

  return (
    <CheckoutForm
      zones={getDeliveryZones(settings)}
      freeDeliveryThreshold={
        typeof settings.freeDeliveryThreshold === 'number' ? settings.freeDeliveryThreshold : null
      }
      bankTransferInstructions={(settings.bankTransferInstructions as string) || ''}
    />
  )
}
