/**
 * One price format for the whole storefront: $X.XX (USD).
 * Fixes the drift where the drawer rounded to whole dollars, the product page
 * printed raw numbers ("$45.5"), and other views used .toFixed(2).
 */
export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`
}
