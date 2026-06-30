// Stock semantics: a product either has sized stock (sizes[] non-empty —
// production pieces in S/M/L…) or a single flat stockQuantity (one-of-a-kind
// and unsized pieces). These helpers keep that rule in one place.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

export type SizeRow = { label: string; stockQuantity: number }

export function getSizes(product: AnyRecord): SizeRow[] {
  if (!Array.isArray(product.sizes)) return []
  return product.sizes
    .filter((s: AnyRecord) => s && typeof s.label === 'string' && typeof s.stockQuantity === 'number')
    .map((s: AnyRecord) => ({ label: s.label as string, stockQuantity: s.stockQuantity as number }))
}

export function totalStock(product: AnyRecord): number {
  const sizes = getSizes(product)
  if (sizes.length > 0) return sizes.reduce((sum, s) => sum + s.stockQuantity, 0)
  return typeof product.stockQuantity === 'number' ? product.stockQuantity : 0
}
