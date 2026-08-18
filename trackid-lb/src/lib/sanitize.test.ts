import { describe, expect, it } from 'vitest'
import { jsonLdScript, safeHref, sanitizeCssColor } from './sanitize'

describe('jsonLdScript', () => {
  it('produces valid JSON for ordinary data', () => {
    const data = { name: 'Vinyl Enamel Pin', price: 10 }
    expect(JSON.parse(jsonLdScript(data))).toEqual(data)
  })

  it('neutralizes a </script> breakout attempt while preserving the value', () => {
    const malicious = { name: '</script><script>alert(1)</script>' }
    const out = jsonLdScript(malicious)
    expect(out).not.toContain('</script>')
    expect(out).not.toContain('<script>')
    // still round-trips to the exact original string once parsed
    expect(JSON.parse(out).name).toBe(malicious.name)
  })
})

describe('safeHref', () => {
  it('allows relative paths', () => {
    expect(safeHref('/shop')).toBe('/shop')
  })

  it('allows http(s), mailto, tel, anchor, and query hrefs', () => {
    expect(safeHref('https://example.com')).toBe('https://example.com')
    expect(safeHref('http://example.com')).toBe('http://example.com')
    expect(safeHref('mailto:hi@example.com')).toBe('mailto:hi@example.com')
    expect(safeHref('tel:+9611234567')).toBe('tel:+9611234567')
    expect(safeHref('#section')).toBe('#section')
    expect(safeHref('?utm_source=x')).toBe('?utm_source=x')
  })

  it('rejects javascript: and other dangerous schemes, falling back to #', () => {
    expect(safeHref('javascript:alert(1)')).toBe('#')
    expect(safeHref('JavaScript:alert(1)')).toBe('#') // case-insensitive
    expect(safeHref('data:text/html,<script>alert(1)</script>')).toBe('#')
    expect(safeHref('vbscript:msgbox(1)')).toBe('#')
  })

  it('falls back to # (or a given fallback) for empty/missing values', () => {
    expect(safeHref(undefined)).toBe('#')
    expect(safeHref(null)).toBe('#')
    expect(safeHref('')).toBe('#')
    expect(safeHref('javascript:alert(1)', '/shop')).toBe('/shop')
  })
})

describe('sanitizeCssColor', () => {
  it('allows real color syntax', () => {
    expect(sanitizeCssColor('#0a0a0a', '#000')).toBe('#0a0a0a')
    expect(sanitizeCssColor('#fff', '#000')).toBe('#fff')
    expect(sanitizeCssColor('rgba(10, 20, 30, 0.5)', '#000')).toBe('rgba(10, 20, 30, 0.5)')
    expect(sanitizeCssColor('transparent', '#000')).toBe('transparent')
    expect(sanitizeCssColor('var(--color-accent)', '#000')).toBe('var(--color-accent)')
  })

  it('rejects a style-tag breakout attempt, falling back', () => {
    expect(sanitizeCssColor('red;}</style><script>alert(1)</script>', '#0a0a0a')).toBe('#0a0a0a')
  })

  it('falls back for empty/missing values', () => {
    expect(sanitizeCssColor(undefined, '#0a0a0a')).toBe('#0a0a0a')
    expect(sanitizeCssColor('', '#0a0a0a')).toBe('#0a0a0a')
  })
})
