import type { CollectionConfig } from 'payload'
import { isAdmin } from '../lib/access'

// Who changed what, when (ROADMAP F0 §1.5) — Orders (status/payment changes),
// Discounts, and SiteSettings write here via afterChange hooks (see
// src/lib/audit-log.ts). Required for dispute resolution once real money and
// multiple staff accounts are involved. Nothing ever writes here through the
// Local API's normal collection flow, so there's no risk of it auditing
// itself into a loop.
export const AuditLog: CollectionConfig = {
  slug: 'audit-log',
  admin: {
    group: 'Site Configuration',
    useAsTitle: 'summary',
    defaultColumns: ['summary', 'userEmail', 'createdAt'],
    // Read-only from the admin's perspective — created only by hooks.
    hidden: false,
  },
  access: {
    read: ({ req }) => isAdmin(req.user),
    create: () => false, // only written via the Local API from hooks (overrideAccess)
    update: () => false,
    delete: ({ req }) => isAdmin(req.user),
  },
  fields: [
    { name: 'collectionSlug', type: 'text', required: true, index: true },
    { name: 'documentId', type: 'text', admin: { description: 'Empty for globals (e.g. Site Settings).' } },
    {
      name: 'action',
      type: 'select',
      required: true,
      options: [
        { label: 'Create', value: 'create' },
        { label: 'Update', value: 'update' },
        { label: 'Delete', value: 'delete' },
      ],
    },
    {
      name: 'userEmail',
      type: 'text',
      required: true,
      admin: { description: "Snapshot of the admin's email — survives if that user account is later deleted." },
    },
    { name: 'summary', type: 'text', required: true, admin: { description: 'One-line human-readable description.' } },
    {
      name: 'changedFields',
      type: 'json',
      admin: { description: 'Field names that changed (update) or the full new state (create).' },
    },
  ],
  timestamps: true,
}
