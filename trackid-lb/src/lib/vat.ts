// VAT math (ROADMAP Part 3.1). Prices are stored and charged VAT-inclusive
// (standard Lebanese retail practice — the customer never sees a price that
// grows at checkout) — so an invoice doesn't add VAT on top of the total, it
// extracts the VAT share that was already inside it: for a gross amount G at
// rate R%, vat = G × R / (100 + R).
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export type VatBreakdown = { net: number; vat: number; gross: number }

export function computeVatBreakdown(grossTotal: number, vatRatePercent: number): VatBreakdown {
  const gross = round2(Math.max(0, grossTotal))
  if (vatRatePercent <= 0) return { net: gross, vat: 0, gross }
  const vat = round2((gross * vatRatePercent) / (100 + vatRatePercent))
  return { net: round2(gross - vat), vat, gross }
}
