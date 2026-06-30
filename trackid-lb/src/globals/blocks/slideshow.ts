import type { Block } from 'payload'

export const SlideshowBlock: Block = {
  slug: 'slideshow',
  labels: { singular: 'Slideshow', plural: 'Slideshows' },
  fields: [
    {
      name: 'slides',
      type: 'array',
      minRows: 1,
      admin: { description: 'Each slide is a full-screen panel. Add at least one.' },
      fields: [
        {
          name: 'bgImageMedia',
          type: 'upload',
          relationTo: 'media',
          admin: { description: 'Pick or upload a slide background. Fills the URL below.' },
        },
        {
          name: 'bgImage',
          type: 'text',
          admin: { description: 'Auto-filled from the image above, or paste a Supabase Storage public URL.' },
        },
        {
          name: 'bgColor',
          type: 'text',
          defaultValue: '#0a0a0a',
          admin: { description: 'Hex fallback color shown behind/instead of image' },
        },
        {
          name: 'overlayOpacity',
          type: 'number',
          min: 0,
          max: 100,
          defaultValue: 40,
          admin: { description: 'Black overlay 0–100 for text legibility' },
        },
        { name: 'eyebrow', type: 'text' },
        { name: 'headline', type: 'text' },
        { name: 'subline', type: 'text' },
        { name: 'ctaLabel', type: 'text' },
        { name: 'ctaHref', type: 'text' },
      ],
    },
    {
      name: 'height',
      type: 'select',
      defaultValue: '80vh',
      options: [
        { label: '60vh', value: '60vh' },
        { label: '70vh', value: '70vh' },
        { label: '80vh (default)', value: '80vh' },
        { label: 'Full screen (100vh)', value: '100vh' },
      ],
    },
    {
      name: 'autoplayInterval',
      type: 'number',
      defaultValue: 5000,
      admin: { description: 'Milliseconds between auto-advance (default: 5000 = 5s). Set to 0 to disable.' },
    },
    { name: 'hidden', type: 'checkbox', defaultValue: false },
  ],
}
