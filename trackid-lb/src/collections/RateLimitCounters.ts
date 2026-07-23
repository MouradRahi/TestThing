import type { CollectionConfig } from 'payload'
import { isAdmin } from '../lib/access'

// Durable rate-limit state (ROADMAP F0 §1.3) — replaces the in-memory
// sliding-window map in api-guards.ts, which resets per serverless instance
// and is useless once traffic is spread across more than one. Fixed-window
// counters, mutated via a single atomic UPSERT in durable-rate-limit.ts (not
// through Payload's own update path — see that file for why). This
// collection exists purely so the table is schema-managed/migrated like
// everything else; the app never reads/writes it through the Local API.
export const RateLimitCounters: CollectionConfig = {
  slug: 'rate-limit-counters',
  admin: {
    group: 'Customers',
    useAsTitle: 'key',
    defaultColumns: ['key', 'count', 'windowStart'],
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
    { name: 'count', type: 'number', required: true, defaultValue: 0 },
    { name: 'windowStart', type: 'date', required: true },
  ],
  timestamps: false,
}
