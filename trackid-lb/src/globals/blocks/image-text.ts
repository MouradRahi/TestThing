import type { Block } from 'payload'

export const ImageTextBlock: Block = {
  slug: 'image-text',
  labels: { singular: 'Image + Text', plural: 'Image + Text Sections' },
  fields: [
    {
      name: 'image',
      type: 'text',
      required: true,
      admin: { description: 'Supabase Storage public URL' },
    },
    { name: 'imageAlt', type: 'text' },
    { name: 'eyebrow', type: 'text' },
    { name: 'heading', type: 'text' },
    { name: 'body', type: 'textarea' },
    { name: 'ctaLabel', type: 'text' },
    { name: 'ctaHref', type: 'text' },
    {
      name: 'imagePosition',
      type: 'select',
      defaultValue: 'left',
      options: [
        { label: 'Image left, text right', value: 'left' },
        { label: 'Image right, text left', value: 'right' },
      ],
    },
    { name: 'hidden', type: 'checkbox', defaultValue: false },
  ],
}
