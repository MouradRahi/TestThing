import type { CollectionConfig } from 'payload'
import { isAdmin } from '../lib/access'

// "Notify me" requests (ROADMAP Part 6.4) — created via POST
// /api/back-in-stock, consumed by Products' afterChange hook when stock
// transitions from 0 to positive. Scoped to fully-sold-out products in v1
// (not partial size gaps — a customer can already buy the sizes that ARE in
// stock, so a per-size "notify me" alongside a purchasable product is a
// smaller, deferred refinement).
export const BackInStockRequests: CollectionConfig = {
  slug: 'back-in-stock-requests',
  admin: {
    group: 'Customers',
    useAsTitle: 'email',
    defaultColumns: ['product', 'email', 'notifiedAt', 'createdAt'],
    hidden: true,
  },
  access: {
    read: ({ req }) => isAdmin(req.user),
    create: () => false, // via POST /api/back-in-stock (overrideAccess)
    update: () => false,
    delete: ({ req }) => isAdmin(req.user),
  },
  fields: [
    { name: 'product', type: 'relationship', relationTo: 'products', required: true, index: true },
    { name: 'email', type: 'email', required: true, index: true },
    { name: 'customer', type: 'relationship', relationTo: 'customers' },
    { name: 'notifiedAt', type: 'date', admin: { readOnly: true } },
  ],
  timestamps: true,
}
