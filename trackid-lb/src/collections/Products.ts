import type { CollectionConfig } from 'payload'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'artist', 'category', 'status', 'price', 'updatedAt'],
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
          name: 'url',
          type: 'text',
          required: true,
          admin: { description: 'Supabase Storage URL — copy the public URL from the Supabase Storage dashboard (e.g. https://bdbhygelwizizepxewxv.supabase.co/storage/v1/object/public/products/filename.jpg)' },
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
      name: 'stockQuantity',
      type: 'number',
      required: true,
      defaultValue: 1,
      min: 0,
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
