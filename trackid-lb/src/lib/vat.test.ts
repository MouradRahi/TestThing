import { describe, expect, it } from 'vitest'
import { computeVatBreakdown } from './vat'

describe('computeVatBreakdown', () => {
  it('extracts VAT from a VAT-inclusive total at the Lebanon standard rate', () => {
    // $100 gross at 11% → vat = 100 * 11/111 ≈ 9.91, net ≈ 90.09
    const { net, vat, gross } = computeVatBreakdown(100, 11)
    expect(gross).toBe(100)
    expect(vat).toBeCloseTo(9.91, 2)
    expect(net).toBeCloseTo(90.09, 2)
    expect(net + vat).toBeCloseTo(gross, 2)
  })

  it('returns zero VAT when the rate is 0', () => {
    expect(computeVatBreakdown(100, 0)).toEqual({ net: 100, vat: 0, gross: 100 })
  })

  it('returns zero VAT for a negative rate (defensive)', () => {
    expect(computeVatBreakdown(100, -5)).toEqual({ net: 100, vat: 0, gross: 100 })
  })

  it('floors a negative gross total at zero', () => {
    expect(computeVatBreakdown(-50, 11)).toEqual({ net: 0, vat: 0, gross: 0 })
  })

  it('handles a zero gross total', () => {
    expect(computeVatBreakdown(0, 11)).toEqual({ net: 0, vat: 0, gross: 0 })
  })

  it('rounds to the cent', () => {
    const { net, vat, gross } = computeVatBreakdown(33.33, 11)
    expect(gross).toBe(33.33)
    // vat + net should reconcile to the cent
    expect(Math.round((net + vat) * 100) / 100).toBe(gross)
  })
})
