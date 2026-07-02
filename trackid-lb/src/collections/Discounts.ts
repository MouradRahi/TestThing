import type { CollectionConfig } from 'payload'
import { isAdmin } from '../lib/access'

// Discount codes applied at checkout. The actual discount is always recomputed
// server-side in the orders API (see src/lib/discounts.ts) — the code field on
// the form is just a request; the DB is the source of truth.
export const Discounts: CollectionConfig = {
  slug: 'discounts',
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'type', 'value', 'enabled', 'usageCount', 'expiresAt'],
    group: 'Commerce',
  },
  access: {
    read: ({ req }) => !!req.user,
    create: ({ req }) => isAdmin(req.user),
    update: ({ req }) => isAdmin(req.user),
    delete: ({ req }) => isAdmin(req.user),
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'What the customer types at checkout. Case-insensitive — stored uppercase.' },
      hooks: {
        beforeValidate: [
          ({ value }) => (typeof value === 'string' ? value.trim().toUpperCase().replace(/\s+/g, '') : value),
        ],
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'percentage',
      options: [
        { label: 'Percentage off', value: 'percentage' },
        { label: 'Fixed amount off (USD)', value: 'fixed' },
      ],
    },
    {
      name: 'value',
      type: 'number',
      required: true,
      min: 0,
      admin: { description: 'For percentage: 0–100. For fixed: the dollar amount off the subtotal.' },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Uncheck to disable the code without deleting it.' },
    },
    {
      name: 'minSubtotal',
      type: 'number',
      min: 0,
      admin: { description: 'Minimum cart subtotal (USD) required to use this code. Leave empty for none.' },
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        description: 'Optional expiry. The code stops working after this date/time.',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'usageLimit',
      type: 'number',
      min: 0,
      admin: { description: 'Max total redemptions across all customers. Leave empty (or 0) for unlimited.' },
    },
    {
      name: 'usageCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true, description: 'How many times this code has been used. Updated automatically.' },
    },
  ],
  timestamps: true,
}
