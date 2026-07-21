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

// The optional `locale` arg is part of unstable_cache's key, so each locale is
// cached separately. Localized settings fields (tagline, footer, announcement,
// copy) return the requested locale's value, falling back to the default.
export const getSiteSettings = unstable_cache(
  async (locale?: string): Promise<AnyRecord> => {
    try {
      const payload = await getPayload()
      return (await payload.findGlobal({
        slug: 'site-settings',
        ...(locale ? { locale: locale as 'en' | 'ar' } : {}),
      })) as AnyRecord
    } catch {
      return {}
    }
  },
  ['site-settings'],
  { revalidate: TTL, tags: ['site-settings'] },
)

export const getNavigation = unstable_cache(
  async (locale?: string): Promise<AnyRecord> => {
    try {
      const payload = await getPayload()
      return (await payload.findGlobal({
        slug: 'navigation',
        ...(locale ? { locale: locale as 'en' | 'ar' } : {}),
      })) as AnyRecord
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

// Border-radius presets override Tailwind's radius scale at runtime, so every
// `rounded-*` utility (except `rounded-full`) follows the chosen brand shape.
const RADIUS_PRESETS: Record<string, string[]> = {
  sharp: ['--radius:0px', '--radius-xs:0px', '--radius-sm:0px', '--radius-md:0px', '--radius-lg:0px', '--radius-xl:0px', '--radius-2xl:0px'],
  // soft = Tailwind defaults (no overrides)
  round: ['--radius:0.5rem', '--radius-xs:0.25rem', '--radius-sm:0.5rem', '--radius-md:0.625rem', '--radius-lg:0.875rem', '--radius-xl:1.125rem', '--radius-2xl:1.5rem'],
}

export function buildThemeCssVars(settings: AnyRecord): string {
  const t = resolveColorTokens(settings)
  const vars = [
    `--color-bg:${t.bg}`,
    `--color-surface:${t.surface}`,
    `--color-border:${t.border}`,
    `--color-foreground:${t.foreground}`,
    `--color-muted:${t.muted}`,
    `--color-accent:${t.accent}`,
    `--color-accent-hover:${t.accentHover}`,
    `--color-on-accent:${t.onAccent}`,
  ]
  const radius = RADIUS_PRESETS[(settings.borderRadius as string) ?? 'soft']
  if (radius) vars.push(...radius)
  return vars.join(';')
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

// ── Typography ───────────────────────────────────────────────────────────────

const SYSTEM_STACK = "system-ui, -apple-system, 'Segoe UI', sans-serif"

// Each key maps to a CSS font stack. The var(--font-*) names are provided by
// next/font in the frontend layout; the chosen ones are the only fonts the
// browser actually downloads.
export const FONT_STACKS: Record<string, string> = {
  system: SYSTEM_STACK,
  inter: `var(--font-inter), ${SYSTEM_STACK}`,
  'space-grotesk': `var(--font-space-grotesk), ${SYSTEM_STACK}`,
  playfair: `var(--font-playfair), Georgia, 'Times New Roman', serif`,
  'dm-sans': `var(--font-dm-sans), ${SYSTEM_STACK}`,
  manrope: `var(--font-manrope), ${SYSTEM_STACK}`,
}

export const FONT_OPTIONS = [
  { label: 'System (default)', value: 'system' },
  { label: 'Inter', value: 'inter' },
  { label: 'Space Grotesk', value: 'space-grotesk' },
  { label: 'Playfair Display (serif)', value: 'playfair' },
  { label: 'DM Sans', value: 'dm-sans' },
  { label: 'Manrope', value: 'manrope' },
]

export function resolveFontStack(key: unknown): string {
  return (typeof key === 'string' && FONT_STACKS[key]) || SYSTEM_STACK
}

// ── Misc helpers ─────────────────────────────────────────────────────────────

export function resolveCopyright(template: string, storeName = 'trackID.lb'): string {
  return (template || `© {year} ${storeName}`).replace('{year}', String(new Date().getFullYear()))
}

// ── Brand copy (Copy tab) ────────────────────────────────────────────────────
// Resolved strings handed to the email templates so notifications.ts stays a
// pure renderer with no SiteSettings import. Each falls back to the field's
// defaultValue so a fresh/empty install reads identically to the old hardcode.

export const DEFAULT_STORE_NAME = 'trackID.lb'
export const DEFAULT_EMAIL_GREETING =
  'Thank you for supporting the music. Our team will reach out on WhatsApp to confirm your delivery details and arrange handoff.'
export const DEFAULT_EMAIL_FOOTER_NOTE = "Lebanon's music fashion brand."
export const DEFAULT_PRODUCT_BLURB =
  'Hand-painted in Beirut. Each piece is unique — colours and details may vary slightly from the photo.'
export const DEFAULT_PRODUCT_META_TAGLINE = 'One-of-a-kind piece, made in Lebanon.'
export const DEFAULT_PRODUCT_META_PATTERN = 'Hand-painted by {store} — {title}. {tagline}'

/**
 * Product SEO/social description — was hardcoded English on every locale
 * (BUGS.md B10); now built from the (localized) Copy-tab pattern so an /ar
 * page gets Arabic meta copy, and a white-label reseller isn't stuck with
 * "Hand-painted" in their JSON-LD regardless of vertical.
 */
export function resolveProductMetaDescription(
  settings: AnyRecord,
  vars: { store: string; title: string; tagline: string },
): string {
  const pattern = (settings.productMetaPattern as string) || DEFAULT_PRODUCT_META_PATTERN
  return pattern
    .replace('{store}', vars.store)
    .replace('{title}', vars.title)
    .replace('{tagline}', vars.tagline)
    .trim()
}
export const DEFAULT_EMPTY_CART_MESSAGE = 'Find a piece that speaks to you.'
export const DEFAULT_ORDER_THANKYOU_NOTE =
  'Our team will reach out shortly to confirm your delivery details. Keep your phone nearby.'

export type BrandCopy = {
  storeName: string
  emailGreeting: string
  emailFooterNote: string
  /** Reply-to for transactional emails (SiteSettings → Brand → contactEmail) */
  contactEmail?: string
}

export function resolveBrandCopy(settings: AnyRecord): BrandCopy {
  const contactEmail =
    typeof settings.contactEmail === 'string' && settings.contactEmail.includes('@')
      ? settings.contactEmail.trim()
      : undefined
  return {
    storeName: (settings.storeName as string) || DEFAULT_STORE_NAME,
    emailGreeting: (settings.emailGreeting as string) || DEFAULT_EMAIL_GREETING,
    emailFooterNote: (settings.emailFooterNote as string) || DEFAULT_EMAIL_FOOTER_NOTE,
    contactEmail,
  }
}

export function resolveStoreName(settings: AnyRecord): string {
  return (settings.storeName as string) || DEFAULT_STORE_NAME
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
