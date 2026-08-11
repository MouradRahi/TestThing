// WCAG 2.x contrast-ratio math (ENHANCEMENTS E14 leftover) — the
// announcement bar's background/text colors are admin-picked (SiteSettings),
// so an owner could unknowingly choose an unreadable combination. Rather
// than relying on the admin remembering to check contrast by eye, compute it
// and auto-flip the text color to black/white — whichever the background
// actually contrasts better with — when the admin's own pick falls below
// the WCAG AA threshold for normal text (4.5:1).
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return null
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}

function channelLuminance(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
}

export function contrastRatio(hexA: string, hexB: string): number | null {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  if (!a || !b) return null
  const lA = relativeLuminance(a)
  const lB = relativeLuminance(b)
  const lighter = Math.max(lA, lB)
  const darker = Math.min(lA, lB)
  return (lighter + 0.05) / (darker + 0.05)
}

const WCAG_AA_NORMAL_TEXT = 4.5

/**
 * Returns `preferredColor` unchanged when it's readable against `bg`
 * (or when either hex is malformed — never invent contrast for input we
 * can't parse). Otherwise returns whichever of black/white contrasts better
 * with `bg`, guaranteeing a readable result regardless of what was picked.
 */
export function ensureReadableTextColor(bg: string, preferredColor: string): string {
  const ratio = contrastRatio(bg, preferredColor)
  if (ratio === null || ratio >= WCAG_AA_NORMAL_TEXT) return preferredColor
  const blackRatio = contrastRatio(bg, '#000000') ?? 0
  const whiteRatio = contrastRatio(bg, '#ffffff') ?? 0
  return whiteRatio >= blackRatio ? '#ffffff' : '#000000'
}
