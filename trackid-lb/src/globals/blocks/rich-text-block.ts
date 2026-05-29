import type { Block } from 'payload'

export const RichTextBlock: Block = {
  slug: 'rich-text',
  labels: { singular: 'Rich Text', plural: 'Rich Text Sections' },
  fields: [
    { name: 'content', type: 'richText' },
    { name: 'hidden', type: 'checkbox', defaultValue: false },
  ],
}
