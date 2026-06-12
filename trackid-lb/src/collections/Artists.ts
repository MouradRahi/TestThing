import type { CollectionConfig } from 'payload'
import { formatSlug } from '../lib/slug'
import { safeRevalidatePath } from '../lib/revalidate'

export const Artists: CollectionConfig = {
  slug: 'artists',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'genre', 'updatedAt'],
  },
  hooks: {
    afterChange: [
      ({ doc, previousDoc }) => {
        safeRevalidatePath('/shop')
        if (doc?.slug) safeRevalidatePath(`/artist/${doc.slug}`)
        if (previousDoc?.slug && previousDoc.slug !== doc?.slug) {
          safeRevalidatePath(`/artist/${previousDoc.slug}`)
        }
      },
    ],
    afterDelete: [
      ({ doc }) => {
        safeRevalidatePath('/shop')
        if (doc?.slug) safeRevalidatePath(`/artist/${doc.slug}`)
      },
    ],
  },
  fields: [
    {
      name: 'name',
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
        description: 'Auto-generated from the name if left empty, e.g. "fairouz" or "mashrou-leila"',
      },
    },
    {
      name: 'bio',
      type: 'textarea',
    },
    {
      name: 'genre',
      type: 'text',
    },
    {
      name: 'photo',
      type: 'text',
      admin: {
        description: 'Supabase Storage URL — copy the public URL from the Supabase Storage dashboard (e.g. https://bdbhygelwizizepxewxv.supabase.co/storage/v1/object/public/products/filename.jpg)',
      },
    },
  ],
}
