import { describe, expect, it } from 'vitest'
import { computeDiscountAmount } from './discounts'

describe('computeDiscountAmount', () => {
  it('computes a percentage discount', () => {
    expect(computeDiscountAmount('percentage', 20, 100)).toBe(20)
    expect(computeDiscountAmount('percentage', 10, 49.99)).toBe(5)
  })

  it('computes a fixed discount', () => {
    expect(computeDiscountAmount('fixed', 15, 100)).toBe(15)
  })

  it('clamps a fixed discount to the subtotal — never a negative total', () => {
    expect(computeDiscountAmount('fixed', 500, 30)).toBe(30)
  })

  it('clamps a percentage discount at 100%', () => {
    expect(computeDiscountAmount('percentage', 250, 40)).toBe(40)
  })

  it('never goes negative', () => {
    expect(computeDiscountAmount('fixed', -10, 100)).toBe(0)
    expect(computeDiscountAmount('percentage', -20, 100)).toBe(0)
  })

  it('rounds to the nearest cent', () => {
    // 33.333...% of 10 = 3.3333... → rounds to 3.33
    expect(computeDiscountAmount('percentage', 33.333, 10)).toBe(3.33)
  })

  it('handles a zero subtotal without dividing by zero or going negative', () => {
    expect(computeDiscountAmount('percentage', 50, 0)).toBe(0)
    expect(computeDiscountAmount('fixed', 10, 0)).toBe(0)
  })
})
