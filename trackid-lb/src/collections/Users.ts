import type { CollectionConfig } from 'payload'
import { isAdmin } from '../lib/access'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
  },
  // Only admins manage accounts; editors can read the list and edit themselves.
  // (Payload's create-first-user flow bypasses access, so fresh installs still work.)
  access: {
    create: ({ req }) => isAdmin(req.user),
    read: ({ req }) => !!req.user,
    update: ({ req, id }) => isAdmin(req.user) || String(req.user?.id) === String(id),
    delete: ({ req }) => isAdmin(req.user),
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      options: ['admin', 'editor'],
      defaultValue: 'editor',
      required: true,
      // Editors can update their own profile but must not promote themselves
      access: {
        update: ({ req }) => isAdmin(req.user),
      },
    },
  ],
}
