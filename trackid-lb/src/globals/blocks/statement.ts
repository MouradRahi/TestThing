import type { Block } from 'payload'

export const StatementBlock: Block = {
  slug: 'statement',
  labels: { singular: 'Statement', plural: 'Statements' },
  fields: [
    {
      name: 'text',
      type: 'text',
      required: true,
      admin: { description: 'A single impactful sentence — displayed centered in large muted text.' },
    },
    { name: 'hidden', type: 'checkbox', defaultValue: false },
  ],
}
