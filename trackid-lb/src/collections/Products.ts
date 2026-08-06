import type { CollectionConfig } from 'payload'
import { formatSlug } from '../lib/slug'
import { safeRevalidatePath } from '../lib/revalidate'
import { mediaUrl } from '../lib/media-fill'
import { isAdmin } from '../lib/access'
import { totalStock } from '../lib/stock'
import { sendBackInStockEmail } from '../lib/notifications'
import { resolveBrandCopy } from '../lib/site-settings'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'artist', 'category', 'status', 'price', 'updatedAt'],
  },
  // Editors manage the catalog day-to-day (create/update); only admins can
  // delete (ROADMAP F0 §1.6 — the same "no access block = any staff role can
  // delete anything" gap already closed for Orders/Users in Session 9).
  access: {
    read: ({ req }) => !!req.user,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => isAdmin(req.user),
  },
  hooks: {
    // When an image is picked from the Media library, copy its public URL into the
    // `url` text field that the storefront reads — so no component needs to change.
    beforeValidate: [
      async ({ data, req }) => {
        if (data && Array.isArray(data.images)) {
          for (const row of data.images) {
            if (row?.image) {
              const url = await mediaUrl(req.payload, row.image)
              if (url) row.url = url
            }
          }
        }
        return data
      },
    ],
    // Edits (price, stock, publish state) must show on the storefront immediately,
    // not after the ISR window (up to 1h on product pages)
    afterChange: [
      ({ doc, previousDoc }) => {
        safeRevalidatePath('/shop')
        safeRevalidatePath('/')
        if (doc?.slug) safeRevalidatePath(`/product/${doc.slug}`)
        if (previousDoc?.slug && previousDoc.slug !== doc?.slug) {
          safeRevalidatePath(`/product/${previousDoc.slug}`)
        }
      },
      // Back-in-stock notifications (ROADMAP Part 6.4) — fires only on a
      // genuine 0 -> positive transition, scoped to fully-sold-out products
      // (v1 doesn't do per-size "notify me" alongside an otherwise-in-stock
      // product — see BackInStockRequests.ts).
      async ({ doc, previousDoc, req }) => {
        const before = previousDoc ? totalStock(previousDoc) : 0
        const after = totalStock(doc)
        if (before > 0 || after <= 0) return
        try {
          const { docs: pending } = await req.payload.find({
            collection: 'back-in-stock-requests',
            where: { and: [{ product: { equals: doc.id } }, { notifiedAt: { exists: false } }] },
            limit: 500,
            depth: 0,
          })
          if (pending.length === 0) return
          let brand
          try {
            const settings = await req.payload.findGlobal({ slug: 'site-settings' })
            brand = resolveBrandCopy(settings as unknown as Record<string, unknown>)
          } catch {
            // fresh install without the global — notifications.ts applies defaults
          }
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
          for (const request of pending) {
            await sendBackInStockEmail({
              email: request.email,
              productTitle: doc.title,
              productUrl: `${siteUrl}/product/${doc.slug}`,
              brand,
            })
            await req.payload.update({
              collection: 'back-in-stock-requests',
              id: request.id,
              data: { notifiedAt: new Date().toISOString() },
            })
          }
        } catch (err) {
          req.payload.logger.error(`[products] Back-in-stock notification failed: ${String(err)}`)
        }
      },
    ],
    afterDelete: [
      ({ doc }) => {
        safeRevalidatePath('/shop')
        safeRevalidatePath('/')
        if (doc?.slug) safeRevalidatePath(`/product/${doc.slug}`)
      },
    ],
  },
  fields: [
    {
      name: 'title',
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
      admin: { description: 'Auto-generated from the title if left empty; always normalized to lowercase-kebab-case.' },
    },
    {
      name: 'description',
      type: 'richText',
      localized: true,
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Price in USD',
      },
    },
    {
      name: 'images',
      type: 'array',
      minRows: 1,
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Pick from the Media library or upload a new image. Fills the URL below automatically on save.',
          },
        },
        {
          name: 'url',
          type: 'text',
          admin: {
            description: 'Auto-filled from the image above. You can also paste a Supabase Storage public URL directly.',
          },
        },
        {
          name: 'alt',
          type: 'text',
        },
      ],
    },
    {
      name: 'artist',
      type: 'relationship',
      relationTo: 'artists',
      index: true,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      index: true,
    },
    {
      name: 'garmentType',
      type: 'relationship',
      relationTo: 'garment-types',
      index: true,
      admin: {
        description:
          'Powers the "More like this" suggestions on the product page. Managed under Collections → Garment Types.',
      },
    },
    {
      name: 'tags',
      type: 'array',
      fields: [
        {
          name: 'tag',
          type: 'text',
        },
      ],
    },
    {
      name: 'sizes',
      type: 'array',
      admin: {
        description:
          'Sized stock for production pieces (S / M / L / XL…). When any sizes are added, customers must pick one and stock is tracked per size. Leave empty for one-of-a-kind or unsized pieces — the single Stock Quantity below is used instead.',
        condition: (data) => !data?.isOneOfAKind,
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
          admin: { description: 'e.g. S, M, L, XL, Oversized' },
        },
        {
          name: 'stockQuantity',
          type: 'number',
          required: true,
          min: 0,
          defaultValue: 0,
        },
      ],
    },
    {
      name: 'stockQuantity',
      type: 'number',
      required: true,
      defaultValue: 1,
      min: 0,
      admin: {
        description: 'Used when no sizes are configured above (one-of-a-kind / unsized pieces).',
      },
    },
    {
      name: 'stockAdjust',
      type: 'ui',
      admin: {
        components: { Field: '/components/admin/StockAdjustField#StockAdjustField' },
      },
    },
    {
      name: 'isOneOfAKind',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Single unique piece — removes from catalog when sold',
      },
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
    {
      name: 'ratingAvg',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true, description: 'Auto-computed from published reviews (ROADMAP Part 6.2).' },
    },
    {
      name: 'ratingCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: 'preorderEnabled',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Show preorder messaging instead of normal stock messaging (ROADMAP Part 6.4). Does NOT change stock mechanics — set Stock Quantity above to your preorder allocation; it decrements normally as preorders come in.',
      },
    },
    {
      name: 'preorderMessage',
      type: 'text',
      localized: true,
      admin: {
        condition: (data) => !!data?.preorderEnabled,
        description: 'e.g. "Ships in 2–3 weeks"',
      },
    },
    {
      name: 'specs',
      type: 'array',
      admin: {
        description:
          'Flexible key/value specs shown on the product page — materials, care instructions, dimensions, etc. (ROADMAP Part 6.7). Not per-locale in v1 — write once, same for every language (avoids an uncertain nested-locales table shape for a hand-written migration; can be revisited later).',
      },
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'value', type: 'text', required: true },
      ],
    },
  ],
  timestamps: true,
}
