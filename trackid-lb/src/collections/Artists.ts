import type { CollectionConfig } from 'payload'
import { formatSlug } from '../lib/slug'
import { safeRevalidatePath } from '../lib/revalidate'
import { mediaUrl } from '../lib/media-fill'

export const Artists: CollectionConfig = {
  slug: 'artists',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'genre', 'updatedAt'],
  },
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        if (data?.photoMedia) {
          const url = await mediaUrl(req.payload, data.photoMedia)
          if (url) data.photo = url
        }
        return data
      },
    ],
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
      name: 'photoMedia',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Pick from the Media library or upload a photo. Fills the URL below automatically on save.',
      },
    },
    {
      name: 'photo',
      type: 'text',
      admin: {
        description: 'Auto-filled from the photo above. You can also paste a Supabase Storage public URL directly.',
      },
    },
  ],
}
