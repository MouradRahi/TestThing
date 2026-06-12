import type { CollectionConfig } from 'payload'
import { formatSlug } from '../lib/slug'
import { safeRevalidatePath } from '../lib/revalidate'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'updatedAt'],
  },
  hooks: {
    afterChange: [
      ({ doc, previousDoc }) => {
        if (doc?.slug) safeRevalidatePath(`/p/${doc.slug}`)
        if (previousDoc?.slug && previousDoc.slug !== doc?.slug) {
          safeRevalidatePath(`/p/${previousDoc.slug}`)
        }
      },
    ],
    afterDelete: [
      ({ doc }) => {
        if (doc?.slug) safeRevalidatePath(`/p/${doc.slug}`)
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      hooks: { beforeValidate: [formatSlug] },
      admin: {
        description: 'Auto-generated from the title if left empty — e.g. "about", "faq", "artist-fairouz"',
      },
    },
    {
      name: 'content',
      type: 'richText',
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'metaTitle', type: 'text' },
        { name: 'metaDescription', type: 'textarea' },
        { name: 'ogImage', type: 'text', admin: { description: 'Supabase Storage URL — copy the public URL from the Supabase Storage dashboard' } },
      ],
    },
  ],
  timestamps: true,
}
