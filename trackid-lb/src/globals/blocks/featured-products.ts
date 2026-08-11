import type { Block } from 'payload'

export const FeaturedProductsBlock: Block = {
  slug: 'featured-products',
  labels: { singular: 'Featured Products', plural: 'Featured Products' },
  fields: [
    { name: 'sectionTitle', type: 'text', localized: true, defaultValue: 'Latest Drops' },
    { name: 'viewAllLabel', type: 'text', localized: true, defaultValue: 'View all →' },
    { name: 'viewAllHref', type: 'text', defaultValue: '/shop' },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'latest',
      options: [
        { label: 'Latest published products (automatic)', value: 'latest' },
        { label: 'Manual pick', value: 'manual' },
      ],
    },
    {
      name: 'limit',
      type: 'number',
      defaultValue: 6,
      min: 1,
      max: 12,
      admin: {
        description: 'How many products to show',
        condition: (_, siblingData) => siblingData?.source !== 'manual',
      },
    },
    {
      name: 'products',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      admin: {
        description: 'Pick the exact products to feature',
        condition: (_, siblingData) => siblingData?.source === 'manual',
      },
    },
    { name: 'hidden', type: 'checkbox', defaultValue: false },
  ],
}
