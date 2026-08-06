import type { CollectionConfig } from 'payload'
import { isAdmin } from '../lib/access'
import { logAuditEvent } from '../lib/audit-log'
import { sendReturnStatusEmail } from '../lib/notifications'
import { resolveBrandCopy } from '../lib/site-settings'
import { processRefund } from '../lib/payments/service'

// Return/exchange requests (ROADMAP Part 6.1). Created only via
// POST /api/returns (the customer-facing route validates ownership + order
// eligibility) — the collection's own `create` access stays admin-only so
// nothing can forge a return directly against the REST/GraphQL API.
//
// Status flow: requested -> approved -> received -> refunded, or -> rejected
// at any point before received. Two money-adjacent transitions are
// deliberately interpreted narrower than a literal reading of the roadmap
// item ("approved returns restock"): restocking fires on **received** (the
// item is physically back), not on approval (approving just means "yes,
// ship it back" — restocking before that would let a customer keep the item
// *and* get it restocked). Refunding on **refunded** calls the same
// processRefund() the admin's manual "Refund" button already uses (ROADMAP
// F2) — no new money-moving code, just a new caller of the existing,
// already-verified one. If the order isn't in a refundable payment state
// (e.g. a COD order never marked "paid"), the refund attempt fails
// gracefully and logs — the return still records as refunded for workflow
// purposes, but staff must settle the money manually (e.g. a cash refund
// outside the system, which this app never tracked for COD anyway).
export const Returns: CollectionConfig = {
  slug: 'returns',
  admin: {
    group: 'Customers',
    useAsTitle: 'id',
    defaultColumns: ['order', 'customer', 'status', 'createdAt'],
    description: 'Customer-initiated return/exchange requests. Created via the storefront — status changes here drive restock + refund.',
  },
  access: {
    read: ({ req: { user } }) => {
      if (isAdmin(user)) return true
      if (user?.collection === 'customers') return { customer: { equals: user.id } }
      return false
    },
    create: ({ req }) => isAdmin(req.user), // real creation happens via POST /api/returns (overrideAccess)
    update: ({ req }) => isAdmin(req.user),
    delete: ({ req }) => isAdmin(req.user),
  },
  hooks: {
    afterChange: [
      // Restock on entering "received" — scoped to this return's own items,
      // not the whole order (a return can be partial).
      async ({ doc, previousDoc, req }) => {
        if (previousDoc?.status === 'received' || doc?.status !== 'received') return
        const items: Array<{ productId?: string; quantity?: number; size?: string | null }> = Array.isArray(
          doc.items,
        )
          ? doc.items
          : []
        for (const item of items) {
          const id = Number(item.productId)
          const quantity = Number(item.quantity)
          if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1) continue
          try {
            const product = await req.payload.findByID({ collection: 'products', id, depth: 0 })
            if (item.size && Array.isArray(product.sizes)) {
              const sizes = [...product.sizes]
              const idx = sizes.findIndex((s: { label?: string }) => s?.label === item.size)
              if (idx >= 0) {
                sizes[idx] = { ...sizes[idx], stockQuantity: (sizes[idx].stockQuantity ?? 0) + quantity }
                await req.payload.update({ collection: 'products', id, data: { sizes } })
              }
            } else {
              const current = typeof product.stockQuantity === 'number' ? product.stockQuantity : 0
              await req.payload.update({ collection: 'products', id, data: { stockQuantity: current + quantity } })
            }
          } catch (err) {
            req.payload.logger.error(`[returns] Failed to restock product ${item.productId}: ${String(err)}`)
          }
        }
      },
      // Refund on entering "refunded" — reuses processRefund() as-is.
      async ({ doc, previousDoc, req }) => {
        if (previousDoc?.status === 'refunded' || doc?.status !== 'refunded') return
        const items: Array<{ priceAtPurchase?: number; quantity?: number }> = Array.isArray(doc.items)
          ? doc.items
          : []
        const defaultAmount = items.reduce(
          (sum, i) => sum + (Number(i.priceAtPurchase) || 0) * (Number(i.quantity) || 0),
          0,
        )
        const amount = typeof doc.refundAmount === 'number' && doc.refundAmount > 0 ? doc.refundAmount : defaultAmount
        if (!(amount > 0)) return
        // `doc.order` can be a populated object (not a raw id) depending on
        // the depth the triggering update ran at — normalize before handing
        // it to processRefund's findByID, or it silently "Order not found"s.
        const orderId = typeof doc.order === 'object' && doc.order ? (doc.order as { id: number }).id : doc.order
        try {
          const result = await processRefund(req.payload, {
            orderId,
            amount: Math.round(amount * 100) / 100,
            restock: false, // already restocked at "received" above
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            adminEmail: (req.user as any)?.email || 'system',
          })
          if (!result.ok) {
            req.payload.logger.warn(
              `[returns] Auto-refund for return ${doc.id} did not go through (${result.error}) — settle manually.`,
            )
          }
        } catch (err) {
          req.payload.logger.error(`[returns] processRefund threw for return ${doc.id}: ${String(err)}`)
        }
      },
      // Status email — approved/received/refunded/rejected.
      async ({ doc, previousDoc, req }) => {
        const prev = previousDoc?.status
        const next = doc?.status
        if (!prev || prev === next || !doc?.customerEmail) return
        try {
          let brand
          try {
            const settings = await req.payload.findGlobal({ slug: 'site-settings' })
            brand = resolveBrandCopy(settings as unknown as Record<string, unknown>)
          } catch {
            // fresh install without the global — notifications.ts applies defaults
          }
          await sendReturnStatusEmail({
            orderNumber: doc.orderNumber,
            customerName: doc.customerName,
            customerEmail: doc.customerEmail,
            status: next,
            brand,
          })
        } catch (err) {
          req.payload.logger.error(`[returns] Status email failed: ${String(err)}`)
        }
      },
      // Audit trail (ROADMAP F0 §1.5) — status changes are only ever admin-driven.
      async ({ doc, previousDoc, operation, req }) => {
        if (operation !== 'update' || !previousDoc || previousDoc.status === doc.status) return
        await logAuditEvent(req.payload, {
          collectionSlug: 'returns',
          documentId: String(doc.id),
          action: 'update',
          req,
          summary: `Return ${doc.id} for order ${doc.orderNumber}: ${previousDoc.status} → ${doc.status}`,
          changedFields: [{ field: 'status', from: previousDoc.status, to: doc.status }],
        })
      },
    ],
  },
  fields: [
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true, index: true },
    {
      name: 'orderNumber',
      type: 'text',
      required: true,
      admin: { readOnly: true, description: 'Snapshotted at creation for status emails — avoids a relation lookup there.' },
    },
    { name: 'customer', type: 'relationship', relationTo: 'customers', required: true, index: true },
    {
      name: 'customerName',
      type: 'text',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'customerEmail',
      type: 'email',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      admin: { description: 'The specific items (and quantities) being returned — may be a subset of the order.' },
      fields: [
        { name: 'productId', type: 'text', required: true },
        { name: 'titleAtPurchase', type: 'text', required: true },
        { name: 'size', type: 'text' },
        { name: 'priceAtPurchase', type: 'number', required: true },
        { name: 'quantity', type: 'number', required: true, min: 1 },
      ],
    },
    {
      name: 'reason',
      type: 'textarea',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Requested', value: 'requested' },
        { label: 'Approved', value: 'approved' },
        { label: 'Received', value: 'received' },
        { label: 'Refunded', value: 'refunded' },
        { label: 'Rejected', value: 'rejected' },
      ],
      defaultValue: 'requested',
      required: true,
      index: true,
    },
    {
      name: 'refundAmount',
      type: 'number',
      min: 0,
      admin: {
        description: 'Override the auto-computed refund amount (sum of item prices) before marking as Refunded. Leave empty to use the default.',
      },
    },
    {
      name: 'adminNotes',
      type: 'textarea',
      admin: { description: 'Internal notes — e.g. why a return was rejected. Never shown to the customer.' },
    },
  ],
  timestamps: true,
}
