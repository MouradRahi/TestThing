import { describe, expect, it, vi } from 'vitest'

// site-settings.ts imports getPayload() (for the functions this file doesn't
// test) which pulls in @payload-config — a Payload build-time alias, not a
// real module, so it can't resolve outside a Payload/Next build. The two
// functions under test here are pure and never call it; mock it out so the
// module can load at all.
vi.mock('./payload', () => ({ getPayload: async () => ({}) }))

const { getDeliveryZones, resolveDeliveryFee } = await import('./site-settings')

const settingsWithZones = {
  deliveryZones: [
    { label: 'Beirut', fee: 3 },
    { label: 'Mount Lebanon', fee: 5 },
  ],
}

describe('getDeliveryZones', () => {
  it('returns [] when unset or malformed', () => {
    expect(getDeliveryZones({})).toEqual([])
    expect(getDeliveryZones({ deliveryZones: 'not-an-array' })).toEqual([])
  })

  it('filters out malformed zone rows (missing label/fee, wrong types)', () => {
    const zones = getDeliveryZones({
      deliveryZones: [
        { label: 'Beirut', fee: 3 },
        { label: 'Missing fee' },
        { fee: 5 },
        null,
        { label: 'Bad fee type', fee: '5' },
      ],
    })
    expect(zones).toEqual([{ label: 'Beirut', fee: 3 }])
  })
})

describe('resolveDeliveryFee', () => {
  it('returns 0 when no zones are configured — free-text area mode', () => {
    expect(resolveDeliveryFee({}, 'Anywhere', 50)).toBe(0)
  })

  it('returns the matching zone fee', () => {
    expect(resolveDeliveryFee(settingsWithZones, 'Beirut', 50)).toBe(3)
    expect(resolveDeliveryFee(settingsWithZones, 'Mount Lebanon', 50)).toBe(5)
  })

  it('returns null when zones exist but the area matches none — rejects the submission', () => {
    expect(resolveDeliveryFee(settingsWithZones, 'Tripoli', 50)).toBeNull()
  })

  it('returns 0 once the free-delivery threshold is reached', () => {
    const settings = { ...settingsWithZones, freeDeliveryThreshold: 100 }
    expect(resolveDeliveryFee(settings, 'Beirut', 100)).toBe(0)
    expect(resolveDeliveryFee(settings, 'Beirut', 150)).toBe(0)
  })

  it('still charges the zone fee below the free-delivery threshold', () => {
    const settings = { ...settingsWithZones, freeDeliveryThreshold: 100 }
    expect(resolveDeliveryFee(settings, 'Beirut', 99.99)).toBe(3)
  })

  it('ignores a non-numeric freeDeliveryThreshold', () => {
    const settings = { ...settingsWithZones, freeDeliveryThreshold: 'unset' }
    expect(resolveDeliveryFee(settings, 'Beirut', 1000)).toBe(3)
  })
})
