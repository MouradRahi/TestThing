import type { CollectionConfig } from 'payload'
import { isAdmin } from '../lib/access'
import { getPool } from '../lib/db-pool'

// Product reviews & ratings (ROADMAP Part 6.2). Created only via
// POST /api/reviews (validates ownership + computes verifiedPurchase) — the
// collection's own `create` access stays admin-only, same pattern as
// Returns. New reviews land as `pending`; admin moderates to `published` via
// the normal admin edit view (no separate moderation UI needed, mirroring
// how Orders/Returns status changes already work).
export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: {
    group: 'Customers',
    useAsTitle: 'id',
    defaultColumns: ['product', 'customerName', 'rating', 'status', 'createdAt'],
    description: 'Customer reviews. Created via the storefront — moderate by changing status to Published.',
  },
  access: {
    read: ({ req: { user } }) => {
      if (isAdmin(user)) return true
      const publishedOnly = { status: { equals: 'published' } }
      if (user?.collection === 'customers') {
        return { or: [publishedOnly, { customer: { equals: user.id } }] }
      }
      return publishedOnly
    },
    create: ({ req }) => isAdmin(req.user),
    update: ({ req }) => isAdmin(req.user),
    delete: ({ req }) => isAdmin(req.user),
  },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        if (previousDoc?.status === doc.status) return
        await recomputeProductRating(req.payload, doc.product)
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        await recomputeProductRating(req.payload, doc.product)
      },
    ],
  },
  fields: [
    { name: 'product', type: 'relationship', relationTo: 'products', required: true, index: true },
    { name: 'customer', type: 'relationship', relationTo: 'customers', required: true, index: true },
    { name: 'customerName', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'rating', type: 'number', required: true, min: 1, max: 5 },
    { name: 'text', type: 'textarea', required: true },
    {
      name: 'verifiedPurchase',
      type: 'checkbox',
      defaultValue: false,
      admin: { readOnly: true, description: 'Customer has a delivered order containing this product.' },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Published', value: 'published' },
      ],
      defaultValue: 'pending',
      required: true,
      index: true,
    },
  ],
  timestamps: true,
}

// One atomic SQL statement (read the aggregate + write it in the same
// query) rather than Payload's ORM update() — found via verification, not
// assumed: a cross-collection payload.update() called from inside this
// hook reliably timed out ("canceling statement due to statement timeout"
// while locking the products row) and, worse, silently applied *stale*
// data once the backlogged write eventually landed. Reproduced on multiple
// different products, so not a one-off; a plain payload.update() outside a
// hook worked instantly, isolating the ORM-level nested-transaction path as
// the problem. Raw pool queries have been reliable everywhere else in this
// codebase's hooks (stock, discounts, gift cards) — this also happens to be
// a correctness improvement regardless: computing the aggregate and writing
// it in one statement removes the read-then-write race a separate
// find()-then-update() would have under concurrent review submissions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recomputeProductRating(payload: any, product: unknown) {
  const productId = typeof product === 'object' && product ? (product as { id: unknown }).id : product
  if (!productId) return
  const pool = getPool(payload)
  if (!pool) {
    console.error('[reviews] No direct DB pool available — rating not recomputed for product', productId)
    return
  }
  try {
    await pool.query(
      `UPDATE products SET
         rating_count = COALESCE((SELECT count(*) FROM reviews WHERE product_id = $1 AND status = 'published'), 0),
         rating_avg = COALESCE((SELECT round(avg(rating), 1) FROM reviews WHERE product_id = $1 AND status = 'published'), 0)
       WHERE id = $1`,
      [productId],
    )
  } catch (err) {
    console.error('[reviews] Failed to recompute product rating:', err)
  }
}
