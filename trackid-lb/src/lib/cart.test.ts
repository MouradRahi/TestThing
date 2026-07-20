import { describe, expect, it } from 'vitest'
import { cartLineKey } from './cart'

describe('cartLineKey', () => {
  it('combines product id and size into one line key', () => {
    expect(cartLineKey('42', 'M')).toBe('42|M')
  })

  it('treats an unsized product as its own line — trailing separator, empty size', () => {
    expect(cartLineKey('42')).toBe('42|')
    expect(cartLineKey('42', undefined)).toBe('42|')
  })

  it('gives the same product in two sizes two distinct keys', () => {
    expect(cartLineKey('42', 'S')).not.toBe(cartLineKey('42', 'M'))
  })

  it('gives an unsized line a different key than any sized line of the same product', () => {
    expect(cartLineKey('42')).not.toBe(cartLineKey('42', 'S'))
  })
})
