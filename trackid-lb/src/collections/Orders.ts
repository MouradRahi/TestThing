import type { CollectionConfig } from 'payload'
import { isAdmin } from '../lib/access'
import { sendOrderStatusEmail } from '../lib/notifications'
import { resolveBrandCopy } from '../lib/site-settings'

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'customerName', 'orderStatus', 'total', 'createdAt'],
  },
  // Orders are created by the storefront API, not manually in admin
  access: {
    create: () => true,
    read: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => isAdmin(req.user),
  },
  hooks: {
    afterChange: [
      // Tell the customer when their order moves forward (shipped, delivered…).
      // Skipped on creation — the confirmation email already covers that.
      async ({ doc, previousDoc, req }) => {
        const prev = previousDoc?.orderStatus
        const next = doc?.orderStatus
        if (!prev || prev === next || !doc?.customerEmail) return
        try {
          let brand
          try {
            const settings = await req.payload.findGlobal({ slug: 'site-settings' })
            brand = resolveBrandCopy(settings as Record<string, unknown>)
          } catch {
            // fresh install without the global — notifications.ts applies defaults
          }
          await sendOrderStatusEmail({
            orderNumber: doc.orderNumber,
            customerName: doc.customerName,
            customerEmail: doc.customerEmail,
            status: next,
            brand,
          })
        } catch (err) {
          console.error('[orders] Status email failed:', err)
        }
      },
      // Cancelling an order returns its items to stock; un-cancelling takes
      // them back out (floored at 0 if something sold in the meantime).
      async ({ doc, previousDoc, req }) => {
        const prev = previousDoc?.orderStatus
        const next = doc?.orderStatus
        if (!prev || prev === next) return

        const cancelled = next === 'cancelled' && prev !== 'cancelled'
        const reactivated = prev === 'cancelled' && next !== 'cancelled'
        if (!cancelled && !reactivated) return

        const direction = cancelled ? 1 : -1
        const items: Array<{ productId?: string; quantity?: number; size?: string | null }> =
          Array.isArray(doc.items) ? doc.items : []

        for (const item of items) {
          const id = Number(item.productId)
          const quantity = Number(item.quantity)
          if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1) continue
          try {
            const product = await req.payload.findByID({ collection: 'products', id, depth: 0 })
            if (item.size && Array.isArray(product.sizes)) {
              const sizes = [...product.sizes]
              const idx = sizes.findIndex((s: { label?: string }) => s?.label === item.size)
              if (idx < 0) continue
              sizes[idx] = {
                ...sizes[idx],
                stockQuantity: Math.max(0, (sizes[idx].stockQuantity ?? 0) + direction * quantity),
              }
              await req.payload.update({ collection: 'products', id, data: { sizes } })
            } else {
              const current = typeof product.stockQuantity === 'number' ? product.stockQuantity : 0
              await req.payload.update({
                collection: 'products',
                id,
                data: { stockQuantity: Math.max(0, current + direction * quantity) },
              })
            }
          } catch (err) {
            req.payload.logger.error(
              `[orders] Failed to adjust stock for product ${item.productId} after status change: ${String(err)}`,
            )
          }
        }
      },
    ],
  },
  fields: [
    {
      name: 'orderNumber',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'customerName',
      type: 'text',
      required: true,
    },
    {
      name: 'customerPhone',
      type: 'text',
      required: true,
    },
    {
      name: 'customerEmail',
      type: 'email',
    },
    {
      name: 'deliveryAddress',
      type: 'textarea',
      required: true,
    },
    {
      name: 'area',
      type: 'text',
      required: true,
      admin: { description: 'Lebanon area / city (e.g. Beirut, Tripoli, Saida)' },
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        {
          name: 'productId',
          type: 'text',
          required: true,
        },
        {
          name: 'titleAtPurchase',
          type: 'text',
          required: true,
        },
        {
          name: 'size',
          type: 'text',
          admin: { description: 'Chosen size — empty for unsized/one-of-a-kind pieces' },
        },
        {
          name: 'priceAtPurchase',
          type: 'number',
          required: true,
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          min: 1,
        },
        {
          name: 'imageUrl',
          type: 'text',
        },
      ],
    },
    {
      name: 'subtotal',
      type: 'number',
      required: true,
    },
    {
      name: 'deliveryFee',
      type: 'number',
      required: true,
      defaultValue: 0,
    },
    {
      name: 'discountCode',
      type: 'text',
      admin: { readOnly: true, description: 'Discount code applied at checkout (if any).' },
    },
    {
      name: 'discountAmount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true, description: 'Amount taken off the subtotal by the discount code.' },
    },
    {
      name: 'total',
      type: 'number',
      required: true,
    },
    {
      name: 'paymentMethod',
      type: 'select',
      options: [
        { label: 'Cash on Delivery', value: 'cod' },
        { label: 'Bank Transfer', value: 'bank_transfer' },
      ],
      required: true,
      defaultValue: 'cod',
    },
    {
      name: 'paymentStatus',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
      ],
      defaultValue: 'pending',
      index: true,
    },
    {
      name: 'orderStatus',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'In Production', value: 'in_production' },
        { label: 'Shipped', value: 'shipped' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      defaultValue: 'pending',
      required: true,
      index: true,
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: { description: 'Customer notes' },
    },
  ],
  timestamps: true,
}
