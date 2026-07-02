import type { CollectionConfig } from 'payload'
import { formatSlug } from '../lib/slug'
import { safeRevalidatePath } from '../lib/revalidate'

// Admin-managed list of garment types offered on the custom-request form.
// Add / rename / remove freely from the admin — the form and API read this list.
export const GarmentTypes: CollectionConfig = {
  slug: 'garment-types',
  // Drag-and-drop ordering in the admin list view; the form respects this order.
  orderable: true,
  defaultSort: '_order',
  admin: {
    useAsTitle: 'name',
    description:
      'Garment options shown on the Custom Request form. Drag rows to set the order they appear in the dropdown.',
  },
  access: {
    read: () => true, // public — the storefront form lists these
  },
  hooks: {
    afterChange: [() => safeRevalidatePath('/custom-request')],
    afterDelete: [() => safeRevalidatePath('/custom-request')],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      localized: true,
      admin: { description: 'e.g. Hoodie, T-Shirt, Jacket, Tote Bag' },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      hooks: { beforeValidate: [formatSlug] },
      admin: { description: 'Auto-generated from the name if left empty.' },
    },
  ],
}
