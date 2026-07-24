import type { PaymentProvider } from './types'
import { mockProvider, mockPaymentsAllowed } from './mock'

// Every adapter registers here. Real vendors (Areeba/NetCommerce) get added
// the same way once a merchant account exists — checkout, orders, the
// webhook route, and the expiry cron never change.
const PROVIDERS: Record<string, PaymentProvider> = {
  mock: mockProvider,
}

export function getProvider(key: string): PaymentProvider | null {
  return PROVIDERS[key] ?? null
}

/** Providers actually usable right now (env/config permitting) — drives the checkout toggle. */
export function isProviderAvailable(key: string): boolean {
  if (key === 'mock') return mockPaymentsAllowed()
  return false
}
