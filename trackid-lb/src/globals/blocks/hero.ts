import type { Block } from 'payload'

export const HeroBlock: Block = {
  slug: 'hero',
  labels: { singular: 'Hero Section', plural: 'Hero Sections' },
  fields: [
    {
      name: 'eyebrow',
      type: 'text',
      localized: true,
      admin: { description: 'Small label above headline, e.g. "Lebanon · Hand-painted"' },
    },
    { name: 'headline', type: 'text', localized: true },
    { name: 'subline', type: 'text', localized: true },
    { name: 'ctaLabel', type: 'text', localized: true, admin: { description: 'Primary button text, e.g. "Shop Now"' } },
    { name: 'ctaHref', type: 'text', admin: { description: 'Primary button link, e.g. /shop' } },
    { name: 'secondaryCtaLabel', type: 'text', localized: true },
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
      // Values stay 'left'/'right' (no data migration for existing content) —
      // only the labels change. Rendering now uses text-start/text-end, which
      // flip with the page direction, so "Start" is the accurate name: it's
      // the reading-start edge (left in English, right in Arabic), not a
      // fixed physical side.
      options: [
        { label: 'Start', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'End', value: 'right' },
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
