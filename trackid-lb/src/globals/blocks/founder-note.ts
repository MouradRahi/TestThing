import type { Block } from 'payload'

// A named human with a face — the single most effective antidote to an
// anonymous brand voice. Photo optional: with none set, the note renders as
// centered text rather than an empty column.
export const FounderNoteBlock: Block = {
  slug: 'founder-note',
  labels: { singular: 'Founder Note', plural: 'Founder Notes' },
  fields: [
    {
      name: 'photoMedia',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Portrait. Shot in the same light as the rest of the page — 4:5 crops best.' },
    },
    {
      name: 'photo',
      type: 'text',
      admin: { description: 'Filled automatically from the picked image. Paste a URL only if not using the media library.' },
    },
    { name: 'photoAlt', type: 'text', localized: true },
    {
      name: 'quote',
      type: 'textarea',
      required: true,
      localized: true,
      admin: { description: 'Written in first person. Two or three sentences — this is a note, not a bio.' },
    },
    {
      name: 'name',
      type: 'text',
      admin: { description: 'First name is enough, and reads warmer than a full one.' },
    },
    { name: 'role', type: 'text', localized: true, admin: { description: 'e.g. "Founder & painter"' } },
    { name: 'hidden', type: 'checkbox', defaultValue: false },
  ],
}
