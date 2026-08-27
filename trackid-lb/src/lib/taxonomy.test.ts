import { describe, it, expect } from 'vitest'
import { isReservedTaxonomySlug, resolveTermDetails, RESERVED_TAXONOMY_SLUGS } from './taxonomy'

describe('isReservedTaxonomySlug', () => {
  it('rejects slugs that collide with real storefront routes', () => {
    // These would be permanently shadowed by the literal route and 404.
    expect(isReservedTaxonomySlug('shop')).toBe(true)
    expect(isReservedTaxonomySlug('product')).toBe(true)
    expect(isReservedTaxonomySlug('artist')).toBe(true)
    expect(isReservedTaxonomySlug('checkout')).toBe(true)
  })

  it('rejects locale prefixes, which would break /ar routing', () => {
    expect(isReservedTaxonomySlug('en')).toBe(true)
    expect(isReservedTaxonomySlug('ar')).toBe(true)
  })

  it('rejects framework paths', () => {
    expect(isReservedTaxonomySlug('admin')).toBe(true)
    expect(isReservedTaxonomySlug('api')).toBe(true)
  })

  it('is case- and whitespace-insensitive', () => {
    expect(isReservedTaxonomySlug('  SHOP ')).toBe(true)
  })

  it('allows ordinary taxonomy names', () => {
    expect(isReservedTaxonomySlug('manufacturer')).toBe(false)
    expect(isReservedTaxonomySlug('designer')).toBe(false)
    expect(isReservedTaxonomySlug('material')).toBe(false)
    expect(isReservedTaxonomySlug('collection')).toBe(false)
  })

  it('ignores non-strings rather than throwing', () => {
    expect(isReservedTaxonomySlug(undefined)).toBe(false)
    expect(isReservedTaxonomySlug(null)).toBe(false)
    expect(isReservedTaxonomySlug(42)).toBe(false)
  })

  it('covers every storefront route folder that exists today', () => {
    // Guards against a new top-level route being added without reserving it.
    for (const s of ['account', 'blog', 'bundle', 'bundles', 'cart', 'order', 'p', 'pay', 'track', 'custom-request']) {
      expect(RESERVED_TAXONOMY_SLUGS.has(s)).toBe(true)
    }
  })
})

describe('resolveTermDetails', () => {
  const fields = [
    { key: 'country', label: 'Country', fieldType: 'text' as const },
    { key: 'founded', label: 'Founded', fieldType: 'number' as const },
    { key: 'site', label: 'Website', fieldType: 'url' as const },
  ]

  it('pairs saved values with their field definitions', () => {
    const out = resolveTermDetails(fields, [
      { key: 'country', value: 'Lebanon' },
      { key: 'founded', value: '1975' },
    ])
    expect(out).toEqual([
      { key: 'country', label: 'Country', value: 'Lebanon', fieldType: 'text' },
      { key: 'founded', label: 'Founded', value: '1975', fieldType: 'number' },
    ])
  })

  it('preserves the admin-defined field order, not the saved order', () => {
    const out = resolveTermDetails(fields, [
      { key: 'site', value: 'https://example.com' },
      { key: 'country', value: 'Lebanon' },
    ])
    expect(out.map((d) => d.key)).toEqual(['country', 'site'])
  })

  it('omits fields the term left blank', () => {
    const out = resolveTermDetails(fields, [{ key: 'country', value: 'Lebanon' }])
    expect(out).toHaveLength(1)
  })

  it('treats a whitespace-only value as blank', () => {
    expect(resolveTermDetails(fields, [{ key: 'country', value: '   ' }])).toHaveLength(0)
  })

  it('drops values whose field definition has since been deleted', () => {
    // An admin removing a term field should not leave orphan rows rendering.
    const out = resolveTermDetails(fields, [{ key: 'discontinued', value: 'x' }])
    expect(out).toHaveLength(0)
  })

  it('falls back to the key when the label is blank in this locale', () => {
    // `label` is optional precisely so translating a taxonomy does not require
    // translating every term-field label in the same save.
    const out = resolveTermDetails([{ key: 'country', label: '', fieldType: 'text' as const }], [
      { key: 'country', value: 'Lebanon' },
    ])
    expect(out[0]).toMatchObject({ label: 'country', value: 'Lebanon' })
  })

  it('defaults an unknown or missing field type to text', () => {
    const out = resolveTermDetails([{ key: 'country', label: 'Country' }], [
      { key: 'country', value: 'Lebanon' },
    ])
    expect(out[0].fieldType).toBe('text')
  })

  it('returns an empty list for missing or malformed input', () => {
    expect(resolveTermDetails(undefined, undefined)).toEqual([])
    expect(resolveTermDetails(fields, null)).toEqual([])
    expect(resolveTermDetails('nope', [{ key: 'country', value: 'Lebanon' }])).toEqual([])
  })
})
