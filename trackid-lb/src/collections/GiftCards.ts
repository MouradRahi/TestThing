import type { CollectionConfig } from 'payload'
import { isAdmin } from '../lib/access'

// Gift cards (ROADMAP Part 6.3). v1 scope: admin-issued (created in admin —
// e.g. for a promotional giveaway, or recording a manually-settled sale) and
// redeemable at checkout, server-authoritative (src/lib/gift-cards.ts), same
// trust model as discount codes. **Self-service "buy a gift card as a
// virtual product" is deliberately deferred** — that needs its own product-
// like listing and payment collection for a non-physical item, a genuinely
// separate feature from redemption; not attempted in this pass.
export const GiftCards: CollectionConfig = {
  slug: 'gift-cards',
  admin: {
    group: 'Commerce',
    useAsTitle: 'code',
    defaultColumns: ['code', 'remainingBalance', 'initialBalance', 'enabled', 'expiresAt'],
  },
  access: {
    read: ({ req }) => !!req.user,
    create: ({ req }) => isAdmin(req.user),
    update: ({ req }) => isAdmin(req.user),
    delete: ({ req }) => isAdmin(req.user),
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data?.code && typeof data.code === 'string') {
          data.code = data.code.trim().toUpperCase().replace(/\s+/g, '')
        }
        // remainingBalance defaults to initialBalance on create — admin only sets one number
        if (data && data.remainingBalance == null && data.initialBalance != null) {
          data.remainingBalance = data.initialBalance
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'code', type: 'text', required: true, unique: true, index: true, admin: { description: 'Case-insensitive — stored uppercase.' } },
    { name: 'initialBalance', type: 'number', required: true, min: 0 },
    {
      name: 'remainingBalance',
      type: 'number',
      min: 0,
      admin: { description: 'Defaults to Initial Balance on create. Decrements automatically at redemption.' },
    },
    { name: 'purchaserEmail', type: 'email' },
    { name: 'recipientEmail', type: 'email' },
    { name: 'enabled', type: 'checkbox', defaultValue: true },
    { name: 'expiresAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
  ],
  timestamps: true,
}
