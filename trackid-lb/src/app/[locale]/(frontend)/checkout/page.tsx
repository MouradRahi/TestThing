import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { getSiteSettings, getDeliveryZones } from '@/lib/site-settings'
import { getCustomer } from '@/lib/auth'
import { getPayload } from '@/lib/payload'
import { isProviderAvailable } from '@/lib/payments/registry'
import { resolveLoyaltyConfig } from '@/lib/loyalty'
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

  // Gift card/store credit/points (ROADMAP Part 6.3/6.6) — the amounts shown
  // are informational only; the orders API re-reads and re-validates all of
  // this from the DB at submit time, same "client is only a request" trust
  // model as the discount code.
  let storeCreditAvailable = 0
  let loyaltyPointsAvailable = 0
  const loyalty = resolveLoyaltyConfig(settings)
  if (customer) {
    const payload = await getPayload()
    const full = await payload.findByID({ collection: 'customers', id: customer.id, depth: 0 }).catch(() => null)
    storeCreditAvailable = full ? Number(full.storeCredit) || 0 : 0
    loyaltyPointsAvailable = full ? Number(full.loyaltyPoints) || 0 : 0
  }

  const cardProviderKey =
    typeof settings.cardPaymentProvider === 'string' ? settings.cardPaymentProvider : 'mock'
  const cardPaymentsEnabled = Boolean(settings.cardPaymentsEnabled) && isProviderAvailable(cardProviderKey)
  const omtPaymentsEnabled = Boolean(settings.omtPaymentEnabled) && isProviderAvailable('omt')

  return (
    <CheckoutForm
      zones={getDeliveryZones(settings)}
      freeDeliveryThreshold={
        typeof settings.freeDeliveryThreshold === 'number' ? settings.freeDeliveryThreshold : null
      }
      bankTransferInstructions={(settings.bankTransferInstructions as string) || ''}
      cardPaymentsEnabled={cardPaymentsEnabled}
      omtPaymentsEnabled={omtPaymentsEnabled}
      omtInstructions={(settings.omtInstructions as string) || ''}
      prefill={prefill}
      storeCreditAvailable={storeCreditAvailable}
      loyaltyPointsAvailable={loyalty.enabled ? loyaltyPointsAvailable : 0}
      loyaltyBurnPointsPerDollar={loyalty.burnPointsPerDollar}
    />
  )
}
