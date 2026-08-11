import type { GlobalConfig } from 'payload'
import { safeRevalidatePath, safeRevalidateTag } from '../lib/revalidate'
import { mediaUrl } from '../lib/media-fill'
import { logAuditEvent, changedTopLevelFields } from '../lib/audit-log'
import { isAdmin } from '../lib/access'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  admin: {
    group: 'Site Configuration',
    description: 'Global brand settings — store name, colors, announcement bar, footer text.',
  },
  // Admin-only — this global governs money-relevant config (delivery zones,
  // bank transfer instructions) and site-wide branding, not routine editorial
  // work the way Products/Pages are (ROADMAP F0 §1.6, the "Settings" gate).
  access: {
    read: ({ req }) => !!req.user,
    update: ({ req }) => isAdmin(req.user),
  },
  hooks: {
    // Picked Media → copy its public URL into the text field each component reads
    beforeValidate: [
      async ({ data, req }) => {
        if (!data) return data
        if (data.logo) {
          const url = await mediaUrl(req.payload, data.logo)
          if (url) data.logoUrl = url
        }
        if (data.ogImageMedia) {
          const url = await mediaUrl(req.payload, data.ogImageMedia)
          if (url) data.ogImage = url
        }
        if (data.faviconMedia) {
          const url = await mediaUrl(req.payload, data.faviconMedia)
          if (url) data.faviconUrl = url
        }
        return data
      },
    ],
    // Settings feed the layout (theme, nav, footer) of every page — bust everything
    afterChange: [
      () => {
        safeRevalidateTag('site-settings')
        safeRevalidatePath('/', 'layout')
      },
      // Audit trail (ROADMAP F0 §1.5) — globals have no create/update
      // distinction the way collections do, so this only logs when
      // something actually changed (skips the initial empty-install save).
      async ({ doc, previousDoc, req }) => {
        const changes = changedTopLevelFields(previousDoc, doc)
        if (changes.length === 0) return
        await logAuditEvent(req.payload, {
          collectionSlug: 'site-settings',
          action: 'update',
          req,
          summary: `Site Settings updated: ${changes.join(', ')}`,
          changedFields: changes,
        })
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        // ── BRAND ───────────────────────────────────────────────────────────
        {
          label: 'Brand',
          fields: [
            {
              name: 'storeName',
              type: 'text',
              defaultValue: 'trackID.lb',
              admin: { description: 'Displayed in the nav, footer, email subjects, and page titles.' },
            },
            {
              name: 'logo',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Pick or upload a logo. Fills the URL below automatically. Leave blank to use the text logo.',
              },
            },
            {
              name: 'logoUrl',
              type: 'text',
              admin: {
                description:
                  'Auto-filled from the logo above, or paste a Supabase Storage public URL. Leave blank to use the text logo.',
              },
            },
            {
              name: 'tagline',
              type: 'text',
              localized: true,
              defaultValue: 'Hand-painted clothing for the artists you love.',
              admin: {
                description:
                  'Appended to the homepage browser-tab / social-share title ("Store — tagline") and shown on the homepage when no sections are configured.',
              },
            },
            {
              name: 'contactEmail',
              type: 'email',
              admin: {
                description: 'Reply-to address on all order emails; also shown in the footer.',
              },
            },
            {
              name: 'whatsappNumber',
              type: 'text',
              admin: { description: 'Full number with country code, e.g. +96170123456' },
            },
          ],
        },

        // ── COMMERCE ────────────────────────────────────────────────────────
        {
          label: 'Commerce',
          fields: [
            {
              name: 'deliveryZones',
              type: 'array',
              admin: {
                description:
                  'Delivery areas and their fees. When configured, checkout shows these as a dropdown and the fee is added to the total. Leave empty to keep free-text area entry with no fee.',
              },
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  required: true,
                  admin: { description: 'e.g. "Beirut", "Mount Lebanon", "Tripoli & North"' },
                },
                {
                  name: 'fee',
                  type: 'number',
                  required: true,
                  min: 0,
                  admin: { description: 'Delivery fee in USD for this zone' },
                },
              ],
            },
            {
              name: 'freeDeliveryThreshold',
              type: 'number',
              min: 0,
              admin: {
                description:
                  'Order subtotal (USD) at or above which delivery is free. Leave empty to disable.',
              },
            },
            {
              name: 'bankTransferInstructions',
              type: 'textarea',
              admin: {
                description:
                  'Shown at checkout, on the order confirmation page, and in the confirmation email when the customer picks Bank Transfer — bank name, account/IBAN, and what to put as the transfer reference.',
              },
            },
            {
              name: 'cardPaymentsEnabled',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description:
                  'Show "Card" as a checkout payment option (ROADMAP F1). Only the testing "Mock" provider exists so far — real vendor adapters (Areeba/NetCommerce) plug into the same toggle once onboarded. Also requires the ONLINE_PAYMENTS_ENABLED=true environment variable to be set — this checkbox alone is not enough, on purpose (a deploy-time safety net independent of this settings panel).',
              },
            },
            {
              name: 'cardPaymentProvider',
              type: 'select',
              defaultValue: 'mock',
              options: [{ label: 'Mock (testing only)', value: 'mock' }],
              admin: {
                condition: (_, siblingData) => Boolean(siblingData?.cardPaymentsEnabled),
                description:
                  'The Mock provider simulates a payment session for local testing — it is disabled automatically in production unless ALLOW_MOCK_PAYMENTS=true is set.',
              },
            },
            {
              name: 'omtPaymentEnabled',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description:
                  'Show "OMT (pay at branch)" as a checkout payment option (ROADMAP F2). v1 is voucher + manual confirm — no OMT merchant agreement exists yet, so staff confirm payments by hand from the admin dashboard\'s "OMT Payments" panel. Also requires the ONLINE_PAYMENTS_ENABLED=true environment variable to be set — this checkbox alone is not enough, on purpose (a deploy-time safety net independent of this settings panel).',
              },
            },
            {
              name: 'omtInstructions',
              type: 'textarea',
              admin: {
                condition: (_, siblingData) => Boolean(siblingData?.omtPaymentEnabled),
                description:
                  'Shown at checkout and on the order confirmation page alongside the voucher code — e.g. "Pay at any OMT branch within 48 hours."',
              },
            },
            {
              name: 'currencyDisplayMode',
              type: 'select',
              defaultValue: 'usd_only',
              options: [
                { label: 'USD only', value: 'usd_only' },
                { label: 'USD + LBP equivalent', value: 'both' },
              ],
              admin: {
                description:
                  'USD stays the money of record everywhere (payments, discounts, reports). "Both" adds an LBP equivalent next to prices using the exchange rate below.',
              },
            },
            {
              name: 'exchangeRate',
              type: 'number',
              min: 0,
              admin: {
                condition: (_, siblingData) => siblingData?.currencyDisplayMode === 'both',
                description:
                  'LBP per 1 USD, e.g. 89000. Update this as the rate moves — each order snapshots the rate at purchase time, so past orders keep the rate they were placed under.',
              },
            },
            {
              name: 'vatEnabled',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description:
                  'Show VAT on invoices (ROADMAP Part 3.1). Prices are treated as VAT-inclusive — the VAT share is broken out on the invoice, never added on top. Off by default for unregistered small brands.',
              },
            },
            {
              name: 'vatRate',
              type: 'number',
              defaultValue: 11,
              min: 0,
              max: 100,
              admin: {
                condition: (_, siblingData) => Boolean(siblingData?.vatEnabled),
                description: 'VAT rate as a percentage. Lebanon standard rate is 11%.',
              },
            },
            {
              name: 'vatRegistrationNumber',
              type: 'text',
              admin: {
                condition: (_, siblingData) => Boolean(siblingData?.vatEnabled),
                description: 'Shown on invoices under the brand details.',
              },
            },
            {
              name: 'giftCardsCombinableWithDiscounts',
              type: 'checkbox',
              defaultValue: true,
              admin: { description: 'Allow a gift card and a discount code to be applied to the same order (ROADMAP Part 6.3).' },
            },
            {
              name: 'lowStockAlertEnabled',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description:
                  'Email a low-stock summary when any published product is at or below the threshold (ROADMAP Part 3.3). Pushes the dashboard\'s existing low-stock widget instead of relying on someone checking it.',
              },
            },
            {
              name: 'lowStockThreshold',
              type: 'number',
              defaultValue: 3,
              min: 0,
              admin: {
                condition: (_, siblingData) => Boolean(siblingData?.lowStockAlertEnabled),
                description: 'Stock level (per product, or per size) at or below which it counts as low.',
              },
            },
            {
              name: 'lowStockAlertLastSentAt',
              type: 'date',
              admin: {
                readOnly: true,
                description: 'Set automatically — prevents sending twice in the same day.',
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
          ],
        },

        // ── ANNOUNCEMENT BAR ────────────────────────────────────────────────
        {
          label: 'Announcement Bar',
          fields: [
            {
              name: 'announcementEnabled',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: 'Toggle the bar on/off without losing the text.' },
            },
            {
              name: 'announcementText',
              type: 'text',
              localized: true,
              admin: { description: 'e.g. "Free delivery on orders over $50" or "New drop live now →"' },
            },
            {
              name: 'announcementBgColor',
              type: 'text',
              defaultValue: '#e8d5b0',
              admin: { description: 'Background hex color, e.g. #e8d5b0' },
            },
            {
              name: 'announcementTextColor',
              type: 'text',
              defaultValue: '#0a0a0a',
              admin: {
                description:
                  'Text hex color, e.g. #0a0a0a. If this doesn’t contrast enough against the background, the storefront automatically shows black or white instead — whichever reads better — so the bar can never render unreadable.',
              },
            },
            {
              name: 'announcementHref',
              type: 'text',
              admin: { description: 'Optional link — makes the whole bar clickable.' },
            },
          ],
        },

        // ── FOOTER ──────────────────────────────────────────────────────────
        {
          label: 'Footer',
          fields: [
            {
              name: 'footerTagline',
              type: 'text',
              localized: true,
              defaultValue: 'Hand-painted clothing for the artists you love. Made in Lebanon.',
            },
            {
              name: 'footerNote',
              type: 'text',
              localized: true,
              defaultValue: 'Cash on Delivery · Lebanon only',
              admin: { description: 'Displayed in the bottom-right of the footer.' },
            },
            {
              name: 'copyrightText',
              type: 'text',
              defaultValue: '© {year} trackID.lb',
              admin: { description: 'Use {year} as a placeholder for the current year.' },
            },
            {
              name: 'socialLinks',
              type: 'array',
              admin: { description: 'Social media icons shown in the footer.' },
              fields: [
                {
                  name: 'platform',
                  type: 'select',
                  required: true,
                  options: [
                    { label: 'Instagram', value: 'instagram' },
                    { label: 'TikTok', value: 'tiktok' },
                    { label: 'Twitter / X', value: 'twitter' },
                    { label: 'Facebook', value: 'facebook' },
                    { label: 'YouTube', value: 'youtube' },
                  ],
                },
                {
                  name: 'url',
                  type: 'text',
                  required: true,
                  admin: { description: 'Full URL including https://' },
                },
              ],
            },
          ],
        },

        // ── THEME ───────────────────────────────────────────────────────────
        {
          label: 'Theme',
          fields: [
            {
              name: 'headingFont',
              type: 'select',
              defaultValue: 'system',
              admin: { description: 'Font for headings / the logo wordmark.' },
              options: [
                { label: 'System (default)', value: 'system' },
                { label: 'Inter', value: 'inter' },
                { label: 'Space Grotesk', value: 'space-grotesk' },
                { label: 'Playfair Display (serif)', value: 'playfair' },
                { label: 'DM Sans', value: 'dm-sans' },
                { label: 'Manrope', value: 'manrope' },
              ],
            },
            {
              name: 'bodyFont',
              type: 'select',
              defaultValue: 'system',
              admin: { description: 'Font for body text and UI.' },
              options: [
                { label: 'System (default)', value: 'system' },
                { label: 'Inter', value: 'inter' },
                { label: 'Space Grotesk', value: 'space-grotesk' },
                { label: 'Playfair Display (serif)', value: 'playfair' },
                { label: 'DM Sans', value: 'dm-sans' },
                { label: 'Manrope', value: 'manrope' },
              ],
            },
            {
              name: 'borderRadius',
              type: 'select',
              defaultValue: 'soft',
              admin: { description: 'Corner style for cards, buttons, inputs, and images.' },
              options: [
                { label: 'Sharp (0 — editorial)', value: 'sharp' },
                { label: 'Soft (default)', value: 'soft' },
                { label: 'Round (friendly)', value: 'round' },
              ],
            },
            {
              name: 'colorScheme',
              type: 'select',
              defaultValue: 'dark',
              admin: {
                description:
                  'Choose a preset or select Custom to define every color individually.',
              },
              options: [
                { label: 'Dark Editorial (default)', value: 'dark' },
                { label: 'Light Minimal', value: 'light' },
                { label: 'Warm Cream', value: 'warm' },
                { label: 'Custom', value: 'custom' },
              ],
            },
            {
              name: 'customColors',
              type: 'group',
              admin: {
                description: 'All fields accept hex values, e.g. #ffffff',
                condition: (_, siblingData) => siblingData?.colorScheme === 'custom',
              },
              fields: [
                {
                  name: 'bg',
                  type: 'text',
                  admin: { description: 'Page background' },
                },
                {
                  name: 'surface',
                  type: 'text',
                  admin: { description: 'Card / panel background' },
                },
                {
                  name: 'border',
                  type: 'text',
                  admin: { description: 'Border and divider color' },
                },
                {
                  name: 'foreground',
                  type: 'text',
                  admin: { description: 'Primary text color' },
                },
                {
                  name: 'muted',
                  type: 'text',
                  admin: { description: 'Secondary / muted text color' },
                },
                {
                  name: 'accent',
                  type: 'text',
                  admin: { description: 'Button and highlight color' },
                },
                {
                  name: 'accentHover',
                  type: 'text',
                  admin: { description: 'Button hover color' },
                },
                {
                  name: 'onAccent',
                  type: 'text',
                  admin: { description: 'Text color ON accent backgrounds (buttons, badges)' },
                },
              ],
            },
          ],
        },

        // ── SEO ─────────────────────────────────────────────────────────────
        {
          label: 'SEO',
          fields: [
            {
              name: 'metaDescription',
              type: 'textarea',
              localized: true,
              defaultValue:
                'Hand-painted clothing for the artists you love. Made in Lebanon, one piece at a time.',
            },
            {
              name: 'ogImageMedia',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Default social share image. Pick or upload (recommended 1200×630px). Fills the URL below.',
              },
            },
            {
              name: 'ogImage',
              type: 'text',
              admin: {
                description:
                  'Auto-filled from the image above, or paste a Supabase Storage URL. Recommended: 1200×630px.',
              },
            },
            {
              name: 'faviconMedia',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Browser tab icon — square PNG/ICO/SVG. Pick or upload; fills the URL below.',
              },
            },
            {
              name: 'faviconUrl',
              type: 'text',
              admin: {
                description:
                  'Auto-filled from the icon above, or paste a Supabase Storage URL. Leave blank to use the Next.js default.',
              },
            },
            {
              name: 'gaMeasurementId',
              type: 'text',
              admin: {
                description:
                  'Google Analytics 4 Measurement ID (e.g. G-XXXXXXXXXX). Leave blank to disable — the GA script only loads when set.',
              },
            },
            {
              name: 'metaPixelId',
              type: 'text',
              admin: {
                description:
                  'Meta (Facebook) Pixel ID — numeric. Leave blank to disable — the Pixel script only loads when set.',
              },
            },
          ],
        },

        // ── COPY ────────────────────────────────────────────────────────────
        // Brand-voice strings the storefront and emails used to hardcode. Every
        // field falls back to its defaultValue, so a fresh install reads the same
        // as before — a second brand just edits them here, no code change.
        {
          label: 'Copy',
          fields: [
            {
              name: 'productBlurb',
              type: 'textarea',
              localized: true,
              defaultValue:
                'Hand-painted in Beirut. Each piece is unique — colours and details may vary slightly from the photo.',
              admin: { description: 'Short note shown under the details on every product page.' },
            },
            {
              name: 'productMetaTagline',
              type: 'text',
              localized: true,
              defaultValue: 'One-of-a-kind piece, made in Lebanon.',
              admin: {
                description: 'Filled into the {tagline} placeholder in the pattern below.',
              },
            },
            {
              name: 'productMetaPattern',
              type: 'text',
              localized: true,
              defaultValue: 'Hand-painted by {store} — {title}. {tagline}',
              admin: {
                description:
                  'Product SEO/social description template. Placeholders: {store}, {title}, {tagline}. Translate the wording (not just the placeholders) for other locales — word order can differ.',
              },
            },
            {
              name: 'emptyCartMessage',
              type: 'text',
              localized: true,
              defaultValue: 'Find a piece that speaks to you.',
              admin: { description: 'Shown on the cart page when the cart is empty.' },
            },
            {
              name: 'orderThankYouNote',
              type: 'textarea',
              localized: true,
              defaultValue:
                'Our team will reach out shortly to confirm your delivery details. Keep your phone nearby.',
              admin: { description: 'Subtitle on the order-confirmation page after checkout.' },
            },
            {
              name: 'emailGreeting',
              type: 'textarea',
              defaultValue:
                'Thank you for supporting the music. Our team will reach out on WhatsApp to confirm your delivery details and arrange handoff.',
              admin: { description: 'Opening line of the order-confirmation email (after "Hi {name},").' },
            },
            {
              name: 'emailFooterNote',
              type: 'text',
              defaultValue: "Lebanon's music fashion brand.",
              admin: {
                description:
                  'Email footer tagline. Rendered as "{store name} — {this}". Leave the store name out; it is added automatically.',
              },
            },
            {
              name: 'orderNumberPrefix',
              type: 'text',
              defaultValue: 'TRK',
              maxLength: 6,
              admin: {
                description:
                  'Prefix for generated order numbers, e.g. "TRK" → TRK-123456-AB12. Letters/numbers only; changing it does not rename existing orders.',
              },
            },
          ],
        },

        // ── REPORTS ─────────────────────────────────────────────────────────
        // Scheduled email digest (ROADMAP Part 4 §4.2) — a Vercel Cron hits
        // /api/cron/scheduled-reports daily; this config decides whether/what/
        // to whom it actually sends. reportsEmailLastSentAt is internal
        // bookkeeping (dedupe guard), not something an admin edits by hand.
        {
          label: 'Reports',
          fields: [
            {
              name: 'reportsEmailEnabled',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: 'Send a scheduled email digest of the reports below.' },
            },
            {
              name: 'reportsEmailCadence',
              type: 'select',
              defaultValue: 'weekly',
              options: [
                { label: 'Weekly (every Monday, last 7 days)', value: 'weekly' },
                { label: 'Monthly (1st of month, last 30 days)', value: 'monthly' },
              ],
              admin: { condition: (data) => !!data?.reportsEmailEnabled },
            },
            {
              name: 'reportsEmailRecipients',
              type: 'text',
              admin: {
                description: 'Comma-separated email addresses. Leave empty to use Contact Email (Brand tab).',
                condition: (data) => !!data?.reportsEmailEnabled,
              },
            },
            {
              name: 'sendSalesReport',
              type: 'checkbox',
              defaultValue: true,
              admin: { condition: (data) => !!data?.reportsEmailEnabled },
            },
            {
              name: 'sendInventoryReport',
              type: 'checkbox',
              defaultValue: true,
              admin: { condition: (data) => !!data?.reportsEmailEnabled },
            },
            {
              name: 'sendCustomersReport',
              type: 'checkbox',
              defaultValue: false,
              admin: { condition: (data) => !!data?.reportsEmailEnabled },
            },
            {
              name: 'sendDiscountsReport',
              type: 'checkbox',
              defaultValue: false,
              admin: { condition: (data) => !!data?.reportsEmailEnabled },
            },
            {
              name: 'sendPaymentsReport',
              type: 'checkbox',
              defaultValue: false,
              admin: { condition: (data) => !!data?.reportsEmailEnabled },
            },
            {
              name: 'sendVatReport',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description: 'Only produces data when VAT is enabled (Commerce tab).',
                condition: (data) => !!data?.reportsEmailEnabled,
              },
            },
            {
              name: 'reportsEmailLastSentAt',
              type: 'date',
              admin: {
                readOnly: true,
                description: 'Set automatically — prevents sending twice in the same period.',
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
          ],
        },

        // ── LOYALTY ─────────────────────────────────────────────────────────
        // Points + referrals (ROADMAP Part 6.6) — flagged "optional per brand"
        // in the roadmap itself; off by default so it never appears unless
        // deliberately turned on.
        {
          label: 'Loyalty',
          fields: [
            {
              name: 'loyaltyEnabled',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: 'Customers earn points on delivered orders and can redeem them at checkout.' },
            },
            {
              name: 'loyaltyEarnRatePerDollar',
              type: 'number',
              defaultValue: 1,
              min: 0,
              admin: { condition: (data) => !!data?.loyaltyEnabled, description: 'Points earned per $1 spent (order subtotal) once delivered.' },
            },
            {
              name: 'loyaltyBurnPointsPerDollar',
              type: 'number',
              defaultValue: 100,
              min: 1,
              admin: { condition: (data) => !!data?.loyaltyEnabled, description: 'Points required to redeem $1 off at checkout.' },
            },
            {
              name: 'referralReferrerPoints',
              type: 'number',
              defaultValue: 200,
              min: 0,
              admin: { condition: (data) => !!data?.loyaltyEnabled, description: 'Points credited to the referring customer once the referred customer\'s first order is delivered.' },
            },
            {
              name: 'referralRefereePoints',
              type: 'number',
              defaultValue: 100,
              min: 0,
              admin: { condition: (data) => !!data?.loyaltyEnabled, description: 'Signup bonus points credited to a new customer who registered via a referral link.' },
            },
          ],
        },
      ],
    },
  ],
}
