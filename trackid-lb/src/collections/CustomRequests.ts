import type { CollectionConfig } from 'payload'

export const CustomRequests: CollectionConfig = {
  slug: 'custom-requests',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'phone', 'referenceArtist', 'status', 'createdAt'],
  },
  access: {
    create: () => true,
    read: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
      admin: { description: 'What does the customer want painted?' },
    },
    {
      name: 'referenceArtist',
      type: 'text',
      admin: { description: 'Artist or band they want referenced' },
    },
    {
      name: 'referenceSong',
      type: 'text',
    },
    {
      name: 'garmentType',
      type: 'relationship',
      relationTo: 'garment-types',
      admin: { description: 'Managed under Collections → Garment Types.' },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Reviewing', value: 'reviewing' },
        { label: 'Quoted', value: 'quoted' },
        { label: 'Accepted', value: 'accepted' },
        { label: 'Rejected', value: 'rejected' },
      ],
      defaultValue: 'new',
      index: true,
    },
  ],
  timestamps: true,
}
