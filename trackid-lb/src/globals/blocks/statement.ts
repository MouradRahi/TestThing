import type { Block } from 'payload'

export const StatementBlock: Block = {
  slug: 'statement',
  labels: { singular: 'Statement', plural: 'Statements' },
  fields: [
    {
      name: 'text',
      type: 'text',
      required: true,
      localized: true,
      admin: { description: 'A single impactful sentence, displayed centered.' },
    },
    {
      name: 'size',
      type: 'select',
      defaultValue: 'display',
      options: [
        { label: 'Display — large, full brightness (a signature line)', value: 'display' },
        { label: 'Caption — small and muted (a footnote under a section)', value: 'caption' },
      ],
      admin: {
        description:
          'Statement blocks saved before this option existed keep the Caption look until you set this explicitly.',
      },
    },
    { name: 'hidden', type: 'checkbox', defaultValue: false },
  ],
}
