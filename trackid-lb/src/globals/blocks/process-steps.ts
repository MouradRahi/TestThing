import type { Block } from 'payload'

// Numbered "how it's made" strip — the one place on the site where numbered
// markers are earned: the steps ARE an ordered sequence and the order carries
// information (each paint layer waits for the one under it). Step count is
// admin-defined, so the renderer uses an auto-fit grid rather than fixed
// breakpoint columns.
export const ProcessStepsBlock: Block = {
  slug: 'process-steps',
  labels: { singular: 'Process Steps', plural: 'Process Steps' },
  fields: [
    {
      name: 'eyebrow',
      type: 'text',
      localized: true,
      admin: {
        description:
          'Optional small label above the heading. Leave blank on most sections — an eyebrow on every section reads as filler.',
      },
    },
    { name: 'heading', type: 'text', localized: true, admin: { description: 'e.g. "How a piece gets made"' } },
    {
      name: 'intro',
      type: 'textarea',
      localized: true,
      admin: { description: 'One or two sentences. Sits beside the heading on desktop.' },
    },
    {
      name: 'steps',
      type: 'array',
      minRows: 2,
      labels: { singular: 'Step', plural: 'Steps' },
      admin: { description: 'Drag to reorder — the numbers are generated from this order, not typed in.' },
      fields: [
        { name: 'title', type: 'text', required: true, localized: true },
        { name: 'description', type: 'textarea', localized: true },
      ],
    },
    { name: 'hidden', type: 'checkbox', defaultValue: false },
  ],
}
