import type { CollectionConfig } from 'payload'
import { isAdmin } from '../lib/access'

// Idempotency-key store (ROADMAP F0 §1.3) — a client-generated key sent on
// POST /api/orders (and future payment endpoints); a retried/duplicate
// request with the same key returns the original response instead of
// creating a second order. See src/lib/idempotency.ts for the read/write
// logic (goes through the Local API — unlike rate-limit counters, this one
// doesn't need a single-round-trip atomic upsert, just a plain create/find).
export const IdempotencyKeys: CollectionConfig = {
  slug: 'idempotency-keys',
  admin: {
    group: 'Customers',
    useAsTitle: 'key',
    defaultColumns: ['key', 'responseStatus', 'createdAt'],
    hidden: true,
  },
  access: {
    read: ({ req }) => isAdmin(req.user),
    create: () => false,
    update: () => false,
    delete: ({ req }) => isAdmin(req.user),
  },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true },
    { name: 'responseStatus', type: 'number', required: true },
    { name: 'responseBody', type: 'json', required: true },
  ],
  timestamps: true,
}
