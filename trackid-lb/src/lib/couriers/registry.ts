import type { CourierProvider } from './types'

const manual: CourierProvider = {
  key: 'manual',
  label: 'Manual (any courier)',
}

const PROVIDERS: Record<string, CourierProvider> = { manual }

export function getCourierProvider(key: string): CourierProvider | null {
  return PROVIDERS[key] ?? null
}
