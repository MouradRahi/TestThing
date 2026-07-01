import type { GlobalConfig } from 'payload'
import { safeRevalidatePath, safeRevalidateTag } from '../lib/revalidate'
import { mediaUrl } from '../lib/media-fill'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  admin: {
    group: 'Site Configuration',
    description: 'Global brand settings — store name, colors, announcement bar, footer text.',
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
              defaultValue: 'Hand-painted clothing for the artists you love.',
            },
            {
              name: 'contactEmail',
              type: 'email',
              admin: { description: 'Shown in order confirmation emails as reply-to.' },
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
              admin: { description: 'Text hex color, e.g. #0a0a0a' },
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
              defaultValue: 'Hand-painted clothing for the artists you love. Made in Lebanon.',
            },
            {
              name: 'footerNote',
              type: 'text',
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
              defaultValue:
                'Hand-painted in Beirut. Each piece is unique — colours and details may vary slightly from the photo.',
              admin: { description: 'Short note shown under the details on every product page.' },
            },
            {
              name: 'productMetaTagline',
              type: 'text',
              defaultValue: 'One-of-a-kind piece, made in Lebanon.',
              admin: {
                description:
                  'Appended to each product’s SEO/social description: "Hand-painted by {store} — {product}. {this}".',
              },
            },
            {
              name: 'emptyCartMessage',
              type: 'text',
              defaultValue: 'Find a piece that speaks to you.',
              admin: { description: 'Shown on the cart page when the cart is empty.' },
            },
            {
              name: 'orderThankYouNote',
              type: 'textarea',
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
      ],
    },
  ],
}
