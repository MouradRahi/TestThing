import type { CollectionConfig } from 'payload'
import { formatSlug } from '../lib/slug'
import { isAdmin } from '../lib/access'
import { safeRevalidatePath } from '../lib/revalidate'

// Product bundles (ROADMAP Part 6.7) — v1 scope, deliberately: an
// informational landing page listing the component products and a stated
// bundle price as a savings promise. "Add all to cart" adds each component
// at ITS OWN real price — checkout math is untouched. **True bundle-priced
// checkout (charging the bundle price instead of sum-of-parts) is a bigger
// change that would need either a cart-model change or an auto-applied
// bundle discount code — deferred as a documented v2** rather than rushed
// into the money-critical cart/pricing path under time pressure.
export const Bundles: CollectionConfig = {
  slug: 'bundles',
  admin: {
    group: 'Commerce',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'status', 'bundlePrice'],
  },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => isAdmin(req.user),
  },
  hooks: {
    afterChange: [({ doc }) => doc?.slug && safeRevalidatePath(`/bundle/${doc.slug}`)],
    afterDelete: [({ doc }) => doc?.slug && safeRevalidatePath(`/bundle/${doc.slug}`)],
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      hooks: { beforeValidate: [formatSlug] },
    },
    { name: 'description', type: 'textarea', localized: true },
    {
      name: 'products',
      type: 'array',
      required: true,
      minRows: 2,
      fields: [
        { name: 'product', type: 'relationship', relationTo: 'products', required: true },
        { name: 'quantity', type: 'number', required: true, min: 1, defaultValue: 1 },
      ],
    },
    {
      name: 'bundlePrice',
      type: 'number',
      required: true,
      min: 0,
      admin: { description: 'Stated bundle price, shown as the savings vs. buying separately. Informational only — checkout still charges each component at its own price (see collection description).' },
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
