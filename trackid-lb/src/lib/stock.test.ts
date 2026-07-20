import { describe, expect, it } from 'vitest'
import { getSizes, totalStock } from './stock'

describe('getSizes', () => {
  it('returns [] for an unsized product', () => {
    expect(getSizes({})).toEqual([])
    expect(getSizes({ sizes: [] })).toEqual([])
  })

  it('filters out malformed size rows', () => {
    const sizes = getSizes({
      sizes: [
        { label: 'S', stockQuantity: 3 },
        { label: 'M' }, // missing stockQuantity
        { stockQuantity: 5 }, // missing label
        null,
        { label: 'L', stockQuantity: '2' }, // wrong type
      ],
    })
    expect(sizes).toEqual([{ label: 'S', stockQuantity: 3 }])
  })
})

describe('totalStock', () => {
  it('sums sized stock across all sizes', () => {
    const product = {
      sizes: [
        { label: 'S', stockQuantity: 2 },
        { label: 'M', stockQuantity: 3 },
        { label: 'L', stockQuantity: 0 },
      ],
    }
    expect(totalStock(product)).toBe(5)
  })

  it('falls back to flat stockQuantity for unsized products', () => {
    expect(totalStock({ stockQuantity: 7 })).toBe(7)
  })

  it('treats a missing/non-numeric flat stockQuantity as 0', () => {
    expect(totalStock({})).toBe(0)
    expect(totalStock({ stockQuantity: 'unknown' })).toBe(0)
  })

  it('is 0 for a fully sold-out sized product, not the flat field', () => {
    // A sized product's flat stockQuantity is meaningless — sizes[] is authoritative.
    expect(totalStock({ sizes: [{ label: 'S', stockQuantity: 0 }], stockQuantity: 99 })).toBe(0)
  })
})
