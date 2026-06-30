import type { CollectionConfig } from 'payload'
import { formatSlug } from '../lib/slug'
import { safeRevalidatePath } from '../lib/revalidate'
import { mediaUrl } from '../lib/media-fill'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'artist', 'category', 'status', 'price', 'updatedAt'],
  },
  hooks: {
    // When an image is picked from the Media library, copy its public URL into the
    // `url` text field that the storefront reads — so no component needs to change.
    beforeValidate: [
      async ({ data, req }) => {
        if (data && Array.isArray(data.images)) {
          for (const row of data.images) {
            if (row?.image) {
              const url = await mediaUrl(req.payload, row.image)
              if (url) row.url = url
            }
          }
        }
        return data
      },
    ],
    // Edits (price, stock, publish state) must show on the storefront immediately,
    // not after the ISR window (up to 1h on product pages)
    afterChange: [
      ({ doc, previousDoc }) => {
        safeRevalidatePath('/shop')
        safeRevalidatePath('/')
        if (doc?.slug) safeRevalidatePath(`/product/${doc.slug}`)
        if (previousDoc?.slug && previousDoc.slug !== doc?.slug) {
          safeRevalidatePath(`/product/${previousDoc.slug}`)
        }
      },
    ],
    afterDelete: [
      ({ doc }) => {
        safeRevalidatePath('/shop')
        safeRevalidatePath('/')
        if (doc?.slug) safeRevalidatePath(`/product/${doc.slug}`)
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
      admin: { description: 'Auto-generated from the title if left empty; always normalized to lowercase-kebab-case.' },
    },
    {
      name: 'description',
      type: 'richText',
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Price in USD',
      },
    },
    {
      name: 'images',
      type: 'array',
      minRows: 1,
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Pick from the Media library or upload a new image. Fills the URL below automatically on save.',
          },
        },
        {
          name: 'url',
          type: 'text',
          admin: {
            description: 'Auto-filled from the image above. You can also paste a Supabase Storage public URL directly.',
          },
        },
        {
          name: 'alt',
          type: 'text',
        },
      ],
    },
    {
      name: 'artist',
      type: 'relationship',
      relationTo: 'artists',
      index: true,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      index: true,
    },
    {
      name: 'tags',
      type: 'array',
      fields: [
        {
          name: 'tag',
          type: 'text',
        },
      ],
    },
    {
      name: 'sizes',
      type: 'array',
      admin: {
        description:
          'Sized stock for production pieces (S / M / L / XL…). When any sizes are added, customers must pick one and stock is tracked per size. Leave empty for one-of-a-kind or unsized pieces — the single Stock Quantity below is used instead.',
        condition: (data) => !data?.isOneOfAKind,
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
          admin: { description: 'e.g. S, M, L, XL, Oversized' },
        },
        {
          name: 'stockQuantity',
          type: 'number',
          required: true,
          min: 0,
          defaultValue: 0,
        },
      ],
    },
    {
      name: 'stockQuantity',
      type: 'number',
      required: true,
      defaultValue: 1,
      min: 0,
      admin: {
        description: 'Used when no sizes are configured above (one-of-a-kind / unsized pieces).',
      },
    },
    {
      name: 'isOneOfAKind',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Single unique piece — removes from catalog when sold',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      defaultValue: 'draft',
      required: true,
      index: true,
    },
  ],
  timestamps: true,
}
