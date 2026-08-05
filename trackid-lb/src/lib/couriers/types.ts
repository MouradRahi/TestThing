// Courier adapter interface (ROADMAP Part 3.2) — mirrors the payments
// abstraction shape (src/lib/payments/types.ts): a small interface with one
// real implementation (`manual`) for now, so a future real integration
// (Wakilni/Toters, whichever the launch brand uses) is "add a new provider,"
// not "invent the abstraction while also under vendor pressure" — the same
// sequencing the payments code went through (mock → OMT → real gateway).
export interface CourierProvider {
  key: string
  label: string
  /** Returns a public tracking URL for this provider's reference, or null if the provider has none (manual has none). */
  getTrackingUrl?(trackingRef: string): string | null
}
