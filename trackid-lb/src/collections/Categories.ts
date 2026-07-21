import type { CollectionConfig } from 'payload'
import { formatSlug } from '../lib/slug'
import { safeRevalidatePath } from '../lib/revalidate'
import { isAdmin } from '../lib/access'

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
  },
  // Editors manage the catalog day-to-day; only admins can delete (ROADMAP F0 §1.6).
  access: {
    read: ({ req }) => !!req.user,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => isAdmin(req.user),
  },
  hooks: {
    afterChange: [() => safeRevalidatePath('/shop')],
    afterDelete: [() => safeRevalidatePath('/shop')],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      localized: true,
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
