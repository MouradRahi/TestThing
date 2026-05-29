import type { Block } from 'payload'

export const CTABannerBlock: Block = {
  slug: 'cta-banner',
  labels: { singular: 'CTA Banner', plural: 'CTA Banners' },
  fields: [
    { name: 'headline', type: 'text' },
    { name: 'subline', type: 'text' },
    { name: 'ctaLabel', type: 'text' },
    { name: 'ctaHref', type: 'text' },
    {
      name: 'bgImage',
      type: 'text',
      admin: { description: 'Supabase Storage public URL — optional full-bleed background' },
    },
    {
      name: 'bgColor',
      type: 'text',
      admin: { description: 'Hex background color, e.g. #e8d5b0. Defaults to accent color.' },
    },
    {
      name: 'overlayOpacity',
      type: 'number',
      min: 0,
      max: 100,
      defaultValue: 0,
    },
    {
      name: 'textColor',
      type: 'text',
      admin: { description: 'Hex text color. Defaults to on-accent (auto from theme).' },
    },
    { name: 'hidden', type: 'checkbox', defaultValue: false },
  ],
}
