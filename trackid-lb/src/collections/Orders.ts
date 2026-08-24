import type { CollectionConfig } from 'payload'
import { isAdmin } from '../lib/access'
import { sendOrderConfirmationEmail, sendOrderStatusEmail, sendOrderWhatsAppAlert, sendOrderStatusWhatsApp, sendOrderConfirmationWhatsApp } from '../lib/notifications'
import { resolveBrandCopy, getDeliveryZones, resolveVatConfig } from '../lib/site-settings'
import { logAuditEvent } from '../lib/audit-log'
import { generateInvoicePdf } from '../lib/invoices/invoice-pdf'
import { resolveLoyaltyConfig, grantPoints } from '../lib/loyalty'

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
      // Email and WhatsApp are independent channels (WhatsApp doesn't need
      // customerEmail to exist — customerPhone is the only required contact
      // field on an order — so a guest checkout with no email still gets a
      // WhatsApp status update if the business has that integration configured).
      async ({ doc, previousDoc, req }) => {
        const prev = previousDoc?.orderStatus
        const next = doc?.orderStatus
        if (!prev || prev === next) return

        let brand
        try {
          const settings = await req.payload.findGlobal({ slug: 'site-settings' })
          brand = resolveBrandCopy(settings as unknown as Record<string, unknown>)
        } catch {
          // fresh install without the global — notifications.ts applies defaults
        }

        if (doc?.customerEmail) {
          try {
            await sendOrderStatusEmail({
              orderNumber: doc.orderNumber,
              customerName: doc.customerName,
              customerEmail: doc.customerEmail,
              status: next,
              brand,
              locale: doc.locale === 'ar' ? 'ar' : 'en',
              courierName: doc.courierName ?? undefined,
              trackingRef: doc.trackingRef ?? undefined,
            })
          } catch (err) {
            console.error('[orders] Status email failed:', err)
          }
        }

        try {
          await sendOrderStatusWhatsApp({
            orderNumber: doc.orderNumber,
            customerName: doc.customerName,
            customerEmail: doc.customerEmail ?? '',
            customerPhone: doc.customerPhone,
            status: next,
            brand,
          })
        } catch (err) {
          console.error('[orders] Status WhatsApp message failed:', err)
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
      // Online-payment orders (ROADMAP F1 §2.1) are created `awaiting_payment`
      // with no confirmation email yet — this fires it the moment a verified
      // webhook (src/lib/payments/service.ts → applyPaymentEvent) flips
      // paymentStatus to `paid`, mirroring exactly what the orders route
      // already sends immediately for COD/bank-transfer orders. One place
      // owns "what happens when an order becomes paid" regardless of which
      // provider (or a future admin override) got it there.
      async ({ doc, previousDoc, req }) => {
        if (previousDoc?.paymentStatus !== 'awaiting_payment' || doc?.paymentStatus !== 'paid') return
        if (!doc?.customerEmail) return
        try {
          let settings: Record<string, unknown> = {}
          try {
            settings = (await req.payload.findGlobal({ slug: 'site-settings' })) as unknown as Record<string, unknown>
          } catch {
            // fresh install without the global — notifications.ts applies defaults
          }
          const zonesConfigured = getDeliveryZones(settings).length > 0
          const deliveryFee = Number(doc.deliveryFee) || 0
          const items: Array<{
            titleAtPurchase: string
            priceAtPurchase: number
            quantity: number
            size?: string
          }> = Array.isArray(doc.items) ? doc.items : []
          const notificationData = {
            orderId: String(doc.id),
            orderNumber: doc.orderNumber,
            locale: (doc.locale === 'ar' ? 'ar' : 'en') as 'en' | 'ar',
            customerName: doc.customerName,
            customerPhone: doc.customerPhone,
            customerEmail: doc.customerEmail,
            deliveryAddress: doc.deliveryAddress,
            area: doc.area,
            items,
            subtotal: Number(doc.subtotal),
            discountCode: doc.discountCode ?? undefined,
            discountAmount: Number(doc.discountAmount) > 0 ? Number(doc.discountAmount) : undefined,
            total: Number(doc.total),
            paymentMethod: doc.paymentMethod as 'cod' | 'bank_transfer' | 'card' | 'omt',
            deliveryFeeLabel: zonesConfigured ? (deliveryFee === 0 ? 'Free' : `$${deliveryFee.toFixed(2)}`) : undefined,
            exchangeRateAtPurchase:
              typeof doc.exchangeRateAtPurchase === 'number' ? doc.exchangeRateAtPurchase : undefined,
            brand: resolveBrandCopy(settings),
          }
          let invoicePdf: Buffer | undefined
          try {
            const vatConfig = resolveVatConfig(settings)
            invoicePdf = await generateInvoicePdf({
              orderNumber: notificationData.orderNumber,
              createdAt: doc.createdAt,
              customerName: notificationData.customerName,
              customerEmail: notificationData.customerEmail,
              deliveryAddress: notificationData.deliveryAddress,
              area: notificationData.area,
              items,
              subtotal: notificationData.subtotal,
              deliveryFee,
              discountAmount: notificationData.discountAmount,
              discountCode: notificationData.discountCode,
              total: notificationData.total,
              storeName: notificationData.brand.storeName,
              contactEmail: notificationData.brand.contactEmail,
              vat: vatConfig.enabled ? { rate: vatConfig.rate, registrationNumber: vatConfig.registrationNumber } : undefined,
            })
          } catch (err) {
            console.error('[orders] Invoice PDF generation failed (email still sends without it):', err)
          }
          await Promise.allSettled([
            sendOrderConfirmationEmail({ ...notificationData, invoicePdf }),
            sendOrderWhatsAppAlert(notificationData),
            sendOrderConfirmationWhatsApp(notificationData),
          ])
        } catch (err) {
          console.error('[orders] Payment-confirmed notifications failed:', err)
        }
      },
      // Audit trail (ROADMAP F0 §1.5) — orders are only ever updated from
      // admin (the storefront API creates but never updates), so this is
      // exactly the "admin changed an order's status/payment" event the
      // roadmap calls out. logAuditEvent itself no-ops without a staff user.
      async ({ doc, previousDoc, operation, req }) => {
        if (operation !== 'update' || !previousDoc) return
        const changes: string[] = []
        if (previousDoc.orderStatus !== doc.orderStatus) changes.push('orderStatus')
        if (previousDoc.paymentStatus !== doc.paymentStatus) changes.push('paymentStatus')
        if (changes.length === 0) return
        await logAuditEvent(req.payload, {
          collectionSlug: 'orders',
          documentId: String(doc.id),
          action: 'update',
          req,
          summary: `Order ${doc.orderNumber}: ${changes
            .map((f) => `${f} ${previousDoc[f]} → ${doc[f]}`)
            .join(', ')}`,
          changedFields: changes.map((f) => ({ field: f, from: previousDoc[f], to: doc[f] })),
        })
      },
      // Loyalty points + referral rewards (ROADMAP Part 6.6) — earned only
      // on a genuine `-> delivered` transition (not on creation, not on
      // re-entering delivered from some other status), so a cancelled-then-
      // reinstated order can't be farmed for repeat points.
      async ({ doc, previousDoc, req }) => {
        if (previousDoc?.orderStatus === 'delivered' || doc?.orderStatus !== 'delivered') return
        const customerId = typeof doc.customer === 'object' && doc.customer ? (doc.customer as { id: number }).id : doc.customer
        if (!customerId) return
        try {
          let settings: Record<string, unknown> = {}
          try {
            settings = (await req.payload.findGlobal({ slug: 'site-settings' })) as unknown as Record<string, unknown>
          } catch {
            // fresh install without the global
          }
          const loyalty = resolveLoyaltyConfig(settings)
          if (!loyalty.enabled) return

          const earned = Math.round((Number(doc.subtotal) || 0) * loyalty.earnRatePerDollar)
          if (earned > 0) await grantPoints(req.payload, customerId, earned)

          // Referral reward — this customer's FIRST delivered order only,
          // and only once (referralRewardGranted guards against a later
          // status flip-flop re-triggering it).
          const customer = await req.payload.findByID({ collection: 'customers', id: customerId, depth: 0 })
          if (customer?.referredBy && !customer.referralRewardGranted) {
            const referrerId = typeof customer.referredBy === 'object' ? (customer.referredBy as { id: number }).id : customer.referredBy
            const referrerPoints = typeof settings.referralReferrerPoints === 'number' ? settings.referralReferrerPoints : 200
            if (referrerId) await grantPoints(req.payload, referrerId, referrerPoints)
            await req.payload.update({ collection: 'customers', id: customerId, data: { referralRewardGranted: true } })
          }
        } catch (err) {
          req.payload.logger.error(`[orders] Loyalty/referral processing failed: ${String(err)}`)
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
      name: 'invoiceLink',
      type: 'ui',
      admin: {
        components: { Field: '/components/admin/InvoiceDownloadField#InvoiceDownloadField' },
      },
    },
    {
      name: 'orderTimeline',
      type: 'ui',
      admin: {
        components: { Field: '/components/admin/OrderTimelineField#OrderTimelineField' },
      },
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
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      index: true,
      admin: { readOnly: true, description: 'Linked customer account — guest orders have none.' },
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
      name: 'utmSource',
      type: 'text',
      index: true,
      admin: { readOnly: true, description: 'Campaign attribution (ROADMAP Part 7) — from ?utm_source= on the visitor\'s first landing, first-touch.', position: 'sidebar' },
    },
    {
      name: 'utmMedium',
      type: 'text',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'utmCampaign',
      type: 'text',
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'discountCode',
      type: 'text',
      admin: { readOnly: true, description: 'Discount code applied at checkout (if any).' },
    },
    {
      // E12 (ENHANCEMENTS.md) — the storefront locale the customer checked
      // out in, so confirmation/status emails render in the matching
      // language instead of always English.
      name: 'locale',
      type: 'select',
      options: [
        { label: 'English', value: 'en' },
        { label: 'Arabic', value: 'ar' },
      ],
      defaultValue: 'en',
      admin: { readOnly: true, description: 'Storefront locale at checkout — determines the language of order emails.' },
    },
    {
      name: 'discountAmount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true, description: 'Amount taken off the subtotal by the discount code.' },
    },
    {
      name: 'giftCardCode',
      type: 'text',
      admin: { readOnly: true, description: 'Gift card code applied at checkout, if any (ROADMAP Part 6.3).' },
    },
    {
      name: 'giftCardAmount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true, description: 'Amount covered by the gift card.' },
    },
    {
      name: 'storeCreditApplied',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true, description: 'Amount covered by the customer\'s store credit balance (ROADMAP Part 6.3).' },
    },
    {
      name: 'pointsRedeemed',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true, description: 'Loyalty points redeemed at checkout (ROADMAP Part 6.6).' },
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
        { label: 'Card (online)', value: 'card' },
        { label: 'OMT (pay at branch)', value: 'omt' },
      ],
      required: true,
      defaultValue: 'cod',
    },
    {
      name: 'paymentStatus',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Awaiting Payment', value: 'awaiting_payment' },
        { label: 'Paid', value: 'paid' },
        { label: 'Failed', value: 'failed' },
        { label: 'Expired', value: 'expired' },
        { label: 'Refunded', value: 'refunded' },
        { label: 'Partially Refunded', value: 'partially_refunded' },
      ],
      defaultValue: 'pending',
      index: true,
    },
    {
      name: 'paymentExpiresAt',
      type: 'date',
      admin: {
        readOnly: true,
        description:
          'Online-payment orders only. Stock is released and the order cancelled if payment isn\'t confirmed by this time (ROADMAP F1 §2.1).',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'exchangeRateAtPurchase',
      type: 'number',
      admin: {
        readOnly: true,
        description: 'LBP-per-USD rate at the moment of purchase, snapshotted from Site Settings — USD stays the money of record.',
      },
    },
    {
      name: 'refundedAmount',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'How much of this order has been refunded so far (ROADMAP F2 §2.6). Updated only by the admin refund action.',
      },
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
    {
      name: 'courierName',
      type: 'text',
      admin: {
        description:
          'Courier handling this delivery, e.g. "Wakilni" or "Toters" — manual entry (ROADMAP Part 3.2 v1; no real courier API integrated yet). Shown to the customer once set.',
      },
    },
    {
      name: 'trackingRef',
      type: 'text',
      admin: { description: "Courier's tracking reference/number, if they provide one." },
    },
    {
      name: 'dispatchDate',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayOnly' } },
    },
  ],
  timestamps: true,
}
