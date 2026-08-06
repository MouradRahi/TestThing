import type { CollectionConfig } from 'payload'
import { isAdmin } from '../lib/access'

// Storefront customer accounts — a SEPARATE auth collection from staff `Users`.
// Customers authenticate via the storefront (/account/login), never the admin
// panel (admin.user is `Users`, so a customer token can't access /admin).
export const Customers: CollectionConfig = {
  slug: 'customers',
  auth: {
    tokenExpiration: 60 * 60 * 24 * 30, // 30 days — storefront sessions shouldn't expire in 2h
    cookies: {
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    },
    // Payload's built-in email dispatch is unused (no email adapter is configured —
    // the app sends its own branded Resend emails, see src/lib/notifications.ts).
    // The forgot-password route calls disableEmail:true and sends the email itself.
    forgotPassword: {
      expiration: 30 * 60 * 1000, // 30 minutes
    },
  },
  admin: {
    useAsTitle: 'email',
    group: 'Customers',
    defaultColumns: ['name', 'email', 'phone', 'createdAt'],
  },
  access: {
    // Public registration
    create: () => true,
    // A customer sees only their own record; admins see all
    read: ({ req: { user } }) => {
      if (isAdmin(user)) return true
      if (user?.collection === 'customers') return { id: { equals: user.id } }
      return false
    },
    update: ({ req: { user } }) => {
      if (isAdmin(user)) return true
      if (user?.collection === 'customers') return { id: { equals: user.id } }
      return false
    },
    delete: ({ req: { user } }) => isAdmin(user),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'addresses',
      type: 'array',
      admin: { description: 'Saved delivery addresses — offered at checkout.' },
      fields: [
        { name: 'label', type: 'text', admin: { description: 'e.g. Home, Work' } },
        { name: 'area', type: 'text' },
        { name: 'deliveryAddress', type: 'textarea' },
      ],
    },
    {
      name: 'wishlist',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      admin: { description: 'Saved-for-later products.' },
    },
    {
      name: 'cartRecoveryOptOut',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Set via the one-click unsubscribe link in a recovery email (ROADMAP Part 6.5) — never shown in the customer-facing profile form.',
      },
    },
    {
      name: 'storeCredit',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: { description: 'Store credit balance in USD (ROADMAP Part 6.3) — a Returns refund can be issued as credit instead of cash. Applied at checkout.' },
    },
    {
      name: 'loyaltyPoints',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: { description: 'Earned on delivered orders, redeemable at checkout (ROADMAP Part 6.6).' },
    },
    {
      name: 'referredBy',
      type: 'relationship',
      relationTo: 'customers',
      admin: { readOnly: true, description: 'Set at registration from a ?ref= link. Reward is credited once this customer\'s first order is delivered.' },
    },
    {
      name: 'referralRewardGranted',
      type: 'checkbox',
      defaultValue: false,
      admin: { readOnly: true, description: 'Set once the referral reward has been paid out — prevents double-crediting on later orders.' },
    },
  ],
  timestamps: true,
}
