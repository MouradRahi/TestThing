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
      name: 'bgImageMedia',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Pick or upload an optional full-bleed background. Fills the URL below.' },
    },
    {
      name: 'bgImage',
      type: 'text',
      admin: { description: 'Auto-filled from the image above, or paste a Supabase Storage public URL.' },
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
