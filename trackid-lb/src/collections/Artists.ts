import type { CollectionConfig } from 'payload'

export const Artists: CollectionConfig = {
  slug: 'artists',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'genre', 'updatedAt'],
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
      admin: {
        description: 'URL-friendly identifier, e.g. "fairouz" or "mashrou-leila"',
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
        description: 'Cloudinary URL',
      },
    },
  ],
}
