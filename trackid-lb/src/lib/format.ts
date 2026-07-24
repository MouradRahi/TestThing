/**
 * One price format for the whole storefront: $X.XX (USD).
 * Fixes the drift where the drawer rounded to whole dollars, the product page
 * printed raw numbers ("$45.5"), and other views used .toFixed(2).
 */
export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`
}

/**
 * Display-only LBP equivalent (ROADMAP F1 §2.5) — rounded to the nearest
 * whole pound (no fractional LBP in everyday use) with thousands separators.
 * USD stays the money of record; this never feeds back into a calculation.
 */
export function formatLBP(amountUsd: number, exchangeRate: number): string {
  return `${Math.round(amountUsd * exchangeRate).toLocaleString('en-US')} LBP`
}
