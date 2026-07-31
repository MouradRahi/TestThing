import type { CollectionConfig } from 'payload'
import { isAdmin } from '../lib/access'

// Payment attempts against orders (ROADMAP F1 §2.1) — one row per attempt, so
// a retried/failed-then-retried checkout leaves a full trail rather than
// overwriting itself. Written only by the payment service (src/lib/payments/
// service.ts) via the Local API, never through a public request — the
// webhook route looks payments up by providerRef and updates through the
// same service, not directly.
export const Payments: CollectionConfig = {
  slug: 'payments',
  admin: {
    group: 'Commerce',
    useAsTitle: 'providerRef',
    defaultColumns: ['order', 'provider', 'status', 'amount', 'currency', 'createdAt'],
    description: 'Payment attempts against orders. Created and updated only by the checkout/webhook flow.',
  },
  access: {
    read: ({ req }) => isAdmin(req.user),
    create: () => false,
    update: () => false,
    delete: ({ req }) => isAdmin(req.user),
  },
  fields: [
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true, index: true },
    {
      name: 'provider',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Mock (testing)', value: 'mock' },
        { label: 'OMT (pay at branch)', value: 'omt' },
      ],
      admin: { description: 'New vendors (Areeba, NetCommerce, …) get added here as their adapters ship.' },
    },
    {
      name: 'providerRef',
      type: 'text',
      required: true,
      index: true,
      admin: { readOnly: true, description: "The provider's own reference for this attempt." },
    },
    { name: 'amount', type: 'number', required: true, admin: { readOnly: true } },
    { name: 'currency', type: 'text', required: true, defaultValue: 'USD', admin: { readOnly: true } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'initiated',
      index: true,
      options: [
        { label: 'Initiated', value: 'initiated' },
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Failed', value: 'failed' },
        { label: 'Expired', value: 'expired' },
        { label: 'Refunded', value: 'refunded' },
        { label: 'Partially Refunded', value: 'partially_refunded' },
      ],
    },
    {
      name: 'rawEvents',
      type: 'json',
      admin: { readOnly: true, description: 'Raw webhook payloads received for this payment (audit trail).' },
    },
  ],
  timestamps: true,
}
