import type { CollectionConfig } from 'payload'
import { isAdmin } from '../lib/access'

// Server-backed cart (replaces the old localStorage cart). A cart belongs to
// either a logged-in customer or a guest session (httpOnly `cart-session`
// cookie). Managed only via the /api/cart route (local API, overrideAccess) —
// public REST writes are blocked.
export const Carts: CollectionConfig = {
  slug: 'carts',
  admin: {
    group: 'Customers',
    useAsTitle: 'id',
    defaultColumns: ['id', 'customer', 'updatedAt'],
    hidden: true, // internal — not a hand-edited collection
  },
  access: {
    read: ({ req }) => isAdmin(req.user),
    create: () => false,
    update: () => false,
    delete: ({ req }) => isAdmin(req.user),
  },
  fields: [
    {
      name: 'sessionId',
      type: 'text',
      index: true,
      admin: { description: 'Guest session id (from the cart-session cookie). Empty once claimed by an account.' },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      index: true,
    },
    {
      name: 'items',
      type: 'array',
      fields: [
        { name: 'product', type: 'relationship', relationTo: 'products', required: true },
        { name: 'size', type: 'text' },
        { name: 'quantity', type: 'number', required: true, min: 1 },
      ],
    },
  ],
  timestamps: true,
}
