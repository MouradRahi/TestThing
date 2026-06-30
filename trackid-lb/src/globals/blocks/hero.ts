import type { Block } from 'payload'

export const HeroBlock: Block = {
  slug: 'hero',
  labels: { singular: 'Hero Section', plural: 'Hero Sections' },
  fields: [
    { name: 'eyebrow', type: 'text', admin: { description: 'Small label above headline, e.g. "Lebanon · Hand-painted"' } },
    { name: 'headline', type: 'text' },
    { name: 'subline', type: 'text' },
    { name: 'ctaLabel', type: 'text', admin: { description: 'Primary button text, e.g. "Shop Now"' } },
    { name: 'ctaHref', type: 'text', admin: { description: 'Primary button link, e.g. /shop' } },
    { name: 'secondaryCtaLabel', type: 'text' },
    { name: 'secondaryCtaHref', type: 'text' },
    {
      name: 'bgImageMedia',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Pick or upload a full-bleed background image. Fills the URL below.' },
    },
    {
      name: 'bgImage',
      type: 'text',
      admin: { description: 'Auto-filled from the image above, or paste a Supabase Storage public URL.' },
    },
    {
      name: 'bgColor',
      type: 'text',
      admin: { description: 'Hex background color, e.g. #0a0a0a (shown behind/instead of image)' },
    },
    {
      name: 'overlayOpacity',
      type: 'number',
      min: 0,
      max: 100,
      defaultValue: 0,
      admin: { description: 'Black overlay over bg image 0–100 (use 30–60 to ensure text is readable)' },
    },
    {
      name: 'textAlign',
      type: 'select',
      defaultValue: 'center',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
    },
    {
      name: 'minHeight',
      type: 'select',
      defaultValue: '80vh',
      options: [
        { label: '50vh', value: '50vh' },
        { label: '70vh', value: '70vh' },
        { label: '80vh (default)', value: '80vh' },
        { label: 'Full screen (100vh)', value: '100vh' },
      ],
    },
    { name: 'hidden', type: 'checkbox', defaultValue: false },
  ],
}
