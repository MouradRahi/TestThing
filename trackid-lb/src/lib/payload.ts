import configPromise from '@payload-config'
import { getPayload as getPayloadSDK } from 'payload'

// Singleton so we never open multiple DB connections in dev (hot reload)
let cached: Awaited<ReturnType<typeof getPayloadSDK>> | null = null

export async function getPayload() {
  if (cached) return cached
  const config = await configPromise
  cached = await getPayloadSDK({ config })
  return cached
}
