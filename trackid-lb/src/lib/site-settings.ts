import { unstable_cache } from 'next/cache'
import { getPayload } from './payload'

// ── Color scheme presets ─────────────────────────────────────────────────────

export type ColorTokens = {
  bg: string
  surface: string
  border: string
  foreground: string
  muted: string
  accent: string
  accentHover: string
  onAccent: string
}

export const COLOR_SCHEMES: Record<string, ColorTokens> = {
  dark: {
    bg: '#0a0a0a',
    surface: '#111111',
    border: '#1a1a1a',
    foreground: '#f0ede8',
    muted: '#888888',
    accent: '#e8d5b0',
    accentHover: '#d4c090',
    onAccent: '#0a0a0a',
  },
  light: {
    bg: '#ffffff',
    surface: '#f5f5f5',
    border: '#e0e0e0',
    foreground: '#0a0a0a',
    muted: '#777777',
    accent: '#0a0a0a',
    accentHover: '#333333',
    onAccent: '#ffffff',
  },
  warm: {
    bg: '#f5f0e8',
    surface: '#ede8df',
    border: '#d4c8b5',
    foreground: '#1a1007',
    muted: '#7a6a55',
    accent: '#8b5e3c',
    accentHover: '#7a5035',
    onAccent: '#f5f0e8',
  },
}

// ── Cached fetchers ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

const TTL = process.env.NODE_ENV === 'development' ? 1 : 300

export const getSiteSettings = unstable_cache(
  async (): Promise<AnyRecord> => {
    try {
      const payload = await getPayload()
      return (await payload.findGlobal({ slug: 'site-settings' })) as AnyRecord
    } catch {
      return {}
    }
  },
  ['site-settings'],
  { revalidate: TTL, tags: ['site-settings'] },
)

export const getNavigation = unstable_cache(
  async (): Promise<AnyRecord> => {
    try {
      const payload = await getPayload()
      return (await payload.findGlobal({ slug: 'navigation' })) as AnyRecord
    } catch {
      return {}
    }
  },
  ['navigation'],
  { revalidate: TTL, tags: ['navigation'] },
)

// ── Theme helpers ────────────────────────────────────────────────────────────

export function resolveColorTokens(settings: AnyRecord): ColorTokens {
  const scheme = (settings.colorScheme as string) || 'dark'
  if (scheme === 'custom' && settings.customColors) {
    const c = settings.customColors as Partial<ColorTokens>
    const fallback = COLOR_SCHEMES.dark
    return {
      bg: c.bg || fallback.bg,
      surface: c.surface || fallback.surface,
      border: c.border || fallback.border,
      foreground: c.foreground || fallback.foreground,
      muted: c.muted || fallback.muted,
      accent: c.accent || fallback.accent,
      accentHover: c.accentHover || fallback.accentHover,
      onAccent: c.onAccent || fallback.onAccent,
    }
  }
  return COLOR_SCHEMES[scheme] ?? COLOR_SCHEMES.dark
}

export function buildThemeCssVars(settings: AnyRecord): string {
  const t = resolveColorTokens(settings)
  return [
    `--color-bg:${t.bg}`,
    `--color-surface:${t.surface}`,
    `--color-border:${t.border}`,
    `--color-foreground:${t.foreground}`,
    `--color-muted:${t.muted}`,
    `--color-accent:${t.accent}`,
    `--color-accent-hover:${t.accentHover}`,
    `--color-on-accent:${t.onAccent}`,
  ].join(';')
}

// ── Commerce helpers ─────────────────────────────────────────────────────────

export type DeliveryZone = { label: string; fee: number }

export function getDeliveryZones(settings: AnyRecord): DeliveryZone[] {
  if (!Array.isArray(settings.deliveryZones)) return []
  return settings.deliveryZones
    .filter((z: AnyRecord) => z && typeof z.label === 'string' && typeof z.fee === 'number')
    .map((z: AnyRecord) => ({ label: z.label as string, fee: z.fee as number }))
}

/**
 * Delivery fee for a chosen area. Returns:
 * - 0 when no zones are configured (free-text area mode) or free-delivery threshold reached
 * - the zone fee when the area matches a configured zone
 * - null when zones ARE configured but the area matches none (invalid submission)
 */
export function resolveDeliveryFee(settings: AnyRecord, area: string, subtotal: number): number | null {
  const zones = getDeliveryZones(settings)
  if (zones.length === 0) return 0
  const zone = zones.find((z) => z.label === area)
  if (!zone) return null
  const threshold =
    typeof settings.freeDeliveryThreshold === 'number' ? settings.freeDeliveryThreshold : null
  if (threshold !== null && subtotal >= threshold) return 0
  return zone.fee
}

// ── Misc helpers ─────────────────────────────────────────────────────────────

export function resolveCopyright(template: string): string {
  return (template || '© {year} trackID.lb').replace('{year}', String(new Date().getFullYear()))
}

/**
 * Build a wa.me link from a stored WhatsApp number.
 * wa.me wants digits only (country code included, no +, spaces, or dashes).
 * Returns null when no usable number is configured.
 */
export function getWhatsAppLink(number: unknown, prefilledText?: string): string | null {
  if (typeof number !== 'string') return null
  const digits = number.replace(/\D/g, '')
  if (digits.length < 7) return null
  const base = `https://wa.me/${digits}`
  return prefilledText ? `${base}?text=${encodeURIComponent(prefilledText)}` : base
}
