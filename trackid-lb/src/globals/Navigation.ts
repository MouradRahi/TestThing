import type { GlobalConfig } from 'payload'
import { safeRevalidatePath, safeRevalidateTag } from '../lib/revalidate'

export const Navigation: GlobalConfig = {
  slug: 'navigation',
  admin: {
    group: 'Site Configuration',
    description: 'Manage header and footer navigation links without touching code.',
  },
  hooks: {
    afterChange: [
      () => {
        safeRevalidateTag('navigation')
        safeRevalidatePath('/', 'layout')
      },
    ],
  },
  fields: [
    {
      name: 'headerLinks',
      type: 'array',
      admin: {
        description: 'Links shown in the top navigation bar. Order here = order on screen.',
        initCollapsed: false,
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
          localized: true,
        },
        {
          name: 'href',
          type: 'text',
          required: true,
          admin: { description: 'e.g. /shop  or  https://external-site.com' },
        },
        {
          name: 'openInNewTab',
          type: 'checkbox',
          defaultValue: false,
        },
      ],
    },
    {
      name: 'footerColumns',
      type: 'array',
      admin: {
        description: 'Columns rendered in the footer. Each column has a title and its own list of links.',
      },
      fields: [
        {
          name: 'columnTitle',
          type: 'text',
          required: true,
          localized: true,
          admin: { description: 'e.g. "Explore" or "Info"' },
        },
        {
          name: 'links',
          type: 'array',
          fields: [
            {
              name: 'label',
              type: 'text',
              required: true,
              localized: true,
            },
            {
              name: 'href',
              type: 'text',
              required: true,
            },
            {
              name: 'openInNewTab',
              type: 'checkbox',
              defaultValue: false,
            },
          ],
        },
      ],
    },
  ],
}
