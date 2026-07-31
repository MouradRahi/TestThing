import type { PaymentProvider } from './types'
import { mockProvider, mockPaymentsAllowed } from './mock'
import { omtProvider } from './omt'

// Every adapter registers here. Real vendors (Areeba/NetCommerce) get added
// the same way once a merchant account exists — checkout, orders, the
// webhook route, and the expiry cron never change.
const PROVIDERS: Record<string, PaymentProvider> = {
  mock: mockProvider,
  omt: omtProvider,
}

export function getProvider(key: string): PaymentProvider | null {
  return PROVIDERS[key] ?? null
}

/**
 * Deploy-time master switch for every online payment method (card, OMT — not
 * COD/bank-transfer, which never depend on a provider). Independent of
 * Site Settings on purpose: a way to guarantee "nothing clickable that leads
 * nowhere" on prod that doesn't depend on anyone remembering to flip an admin
 * toggle correctly, or on the database at all. Same dev-open/prod-explicit
 * shape as mockPaymentsAllowed() below — free to test locally, must be
 * explicitly turned on per environment once a provider is actually confirmed
 * and ready (Areeba/OMT/Whish agreements).
 */
export function onlinePaymentsEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ONLINE_PAYMENTS_ENABLED === 'true'
}

/** Providers actually usable right now (env/config permitting) — drives the checkout toggle. */
export function isProviderAvailable(key: string): boolean {
  if (!onlinePaymentsEnabled()) return false
  if (key === 'mock') return mockPaymentsAllowed()
  if (key === 'omt') return true // no external dependency in v1 — voucher + manual confirm
  return false
}
