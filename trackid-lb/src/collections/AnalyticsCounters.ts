import type { CollectionConfig } from 'payload'
import { isAdmin } from '../lib/access'

// Daily page-view totals (ROADMAP Part 4 §4.3 — the conversion funnel's
// "sessions" stage). No per-user tracking, no cookies: middleware.ts pings
// one atomic counter increment per real navigation via src/lib/analytics.ts.
// The app never reads/writes this through the Local API except that helper
// and the dashboard queries — same "schema-managed but not hand-edited"
// pattern as RateLimitCounters/IdempotencyKeys.
export const AnalyticsCounters: CollectionConfig = {
  slug: 'analytics-counters',
  admin: {
    group: 'Customers',
    useAsTitle: 'date',
    defaultColumns: ['date', 'pageViews'],
    hidden: true,
  },
  access: {
    read: ({ req }) => isAdmin(req.user),
    create: () => false,
    update: () => false,
    delete: ({ req }) => isAdmin(req.user),
  },
  fields: [
    { name: 'date', type: 'text', required: true, unique: true, index: true, admin: { description: 'YYYY-MM-DD (UTC)' } },
    { name: 'pageViews', type: 'number', required: true, defaultValue: 0 },
  ],
  timestamps: false,
}
