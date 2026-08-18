import type { Block } from 'payload'

// Newsletter capture section (ROADMAP Part 7) — a dedicated homepage/page
// block, in addition to the always-on Footer capture form. Renders nothing
// on the storefront when RESEND_AUDIENCE_ID isn't configured, same env-gate
// as the Footer instance (NewsletterSection.tsx).
export const NewsletterBlock: Block = {
  slug: 'newsletter',
  labels: { singular: 'Newsletter Signup', plural: 'Newsletter Signups' },
  fields: [
    { name: 'heading', type: 'text', localized: true, defaultValue: 'Stay in the loop' },
    {
      name: 'subtext',
      type: 'textarea',
      localized: true,
      defaultValue: 'New drops, restocks, and the occasional discount code — no spam.',
    },
    {
      name: 'bgColor',
      type: 'text',
      admin: { description: 'Hex background color, e.g. #e8d5b0. Leave blank for the default page background.' },
    },
    { name: 'hidden', type: 'checkbox', defaultValue: false },
  ],
}
