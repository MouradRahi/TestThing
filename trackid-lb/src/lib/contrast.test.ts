import { describe, expect, it } from 'vitest'
import { contrastRatio, ensureReadableTextColor } from './contrast'

describe('contrastRatio', () => {
  it('returns the maximum ratio (21:1) for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })

  it('returns 1 for identical colors', () => {
    expect(contrastRatio('#e8d5b0', '#e8d5b0')).toBeCloseTo(1, 5)
  })

  it('is symmetric regardless of argument order', () => {
    const a = contrastRatio('#0a0a0a', '#e8d5b0')
    const b = contrastRatio('#e8d5b0', '#0a0a0a')
    expect(a).toBeCloseTo(b!, 5)
  })

  it('returns null for a malformed hex value', () => {
    expect(contrastRatio('not-a-color', '#ffffff')).toBeNull()
    expect(contrastRatio('#fff', '#ffffff')).toBeNull() // 3-digit shorthand unsupported — explicit, not guessed
  })
})

describe('ensureReadableTextColor', () => {
  it('keeps a color that already passes WCAG AA (4.5:1)', () => {
    // near-black text on the default warm announcement-bar background — passes comfortably
    expect(ensureReadableTextColor('#e8d5b0', '#0a0a0a')).toBe('#0a0a0a')
  })

  it('flips a too-similar pick to whichever of black/white contrasts better', () => {
    // light tan background, light-ish text picked by an admin who didn't check contrast
    const result = ensureReadableTextColor('#e8d5b0', '#d0d0d0')
    expect(['#000000', '#ffffff']).toContain(result)
    expect(contrastRatio('#e8d5b0', result)!).toBeGreaterThanOrEqual(4.5)
  })

  it('picks black over white when the background is light', () => {
    expect(ensureReadableTextColor('#ffffff', '#eeeeee')).toBe('#000000')
  })

  it('picks white over black when the background is dark', () => {
    expect(ensureReadableTextColor('#000000', '#111111')).toBe('#ffffff')
  })

  it('leaves malformed input untouched rather than guessing', () => {
    expect(ensureReadableTextColor('not-a-color', '#123456')).toBe('#123456')
  })
})
