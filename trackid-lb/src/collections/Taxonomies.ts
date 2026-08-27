import type { CollectionConfig } from 'payload'
import { slugify } from '../lib/slug'
import { safeRevalidatePath } from '../lib/revalidate'
import { isAdmin } from '../lib/access'
import { isReservedTaxonomySlug, RESERVED_TAXONOMY_SLUGS, TERM_FIELD_TYPES } from '../lib/taxonomy'

/**
 * An admin-defined grouping for products — "Manufacturer", "Designer",
 * "Material", "Collection". Each row here becomes a URL segment, a set of
 * listing pages, an optional shop filter and an optional product-page row.
 *
 * See src/lib/taxonomy.ts for the reasoning behind this being data rather than
 * generated Payload collections (ROADMAP Part 8.1).
 */
export const Taxonomies: CollectionConfig = {
  slug: 'taxonomies',
  orderable: true,
  defaultSort: '_order',
  admin: {
    useAsTitle: 'labelSingular',
    group: 'Catalog',
    defaultColumns: ['labelSingular', 'slug', 'enabled', 'updatedAt'],
    description:
      'Define your own ways of grouping products. A jewellery brand might add "Designer"; an underwear brand "Manufacturer". Each one gets its own pages at /<url-segment>/<term>, and can appear as a shop filter.',
  },
  access: {
    read: () => true, // public — the storefront renders these
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => isAdmin(req.user),
  },
  hooks: {
    // Payload generates taxonomy_terms.taxonomy_id as NOT NULL but its foreign
    // key as ON DELETE SET NULL, so deleting a taxonomy that still has terms
    // would fail with a raw not-null violation in the admin. Remove the terms
    // first so the delete is clean and the orphans do not linger.
    beforeDelete: [
      async ({ id, req }) => {
        try {
          await req.payload.delete({
            collection: 'taxonomy-terms',
            where: { taxonomy: { equals: id } },
            overrideAccess: true,
          })
        } catch {
          // Surfaced by the delete below if it genuinely blocks; never swallow
          // the user action over a cleanup failure.
        }
      },
    ],
    afterChange: [
      ({ doc, previousDoc }) => {
        safeRevalidatePath('/shop')
        if (doc?.slug) safeRevalidatePath(`/${doc.slug}`)
        // Renaming the URL segment orphans the old paths — clear them too.
        if (previousDoc?.slug && previousDoc.slug !== doc?.slug) {
          safeRevalidatePath(`/${previousDoc.slug}`)
        }
      },
    ],
    afterDelete: [
      ({ doc }) => {
        safeRevalidatePath('/shop')
        if (doc?.slug) safeRevalidatePath(`/${doc.slug}`)
      },
    ],
  },
  fields: [
    {
      name: 'labelSingular',
      type: 'text',
      required: true,
      localized: true,
      admin: { description: 'Shown on a single product, e.g. "Manufacturer" or "Designer".' },
    },
    {
      name: 'labelPlural',
      type: 'text',
      required: true,
      localized: true,
      admin: { description: 'Used for headings and filters, e.g. "Manufacturers".' },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (typeof value === 'string' && value.trim()) return slugify(value)
            const fallback = data?.labelSingular
            if (typeof fallback === 'string' && fallback.trim()) return slugify(fallback)
            return value
          },
        ],
      },
      validate: (value: unknown) => {
        if (typeof value !== 'string' || !value.trim()) return 'A URL segment is required.'
        if (isReservedTaxonomySlug(value)) {
          // Caught here rather than at request time: a reserved slug would be
          // permanently shadowed by a real route and 404 for customers.
          return `"${value}" is reserved by an existing page. Reserved: ${[...RESERVED_TAXONOMY_SLUGS].sort().join(', ')}`
        }
        return true
      },
      admin: {
        description:
          'URL segment — auto-generated from the singular label if left empty. Terms then live at /<segment>/<term-slug>.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
      admin: { description: 'Optional intro shown at the top of the listing page.' },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      index: true,
      admin: { description: 'Turn off to hide this grouping from the storefront without deleting it.' },
    },
    {
      name: 'showInShopFilters',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Show this grouping as filter chips on the Shop page.' },
    },
    {
      name: 'showOnProductPage',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: "Show the product's term for this grouping on the product page." },
    },
    {
      name: 'termFields',
      type: 'array',
      admin: {
        description:
          'Optional extra details each entry can fill in — e.g. a Manufacturer could have "Country" and "Founded". Leave empty if entries only need a name, description and image.',
      },
      fields: [
        {
          name: 'key',
          type: 'text',
          required: true,
          hooks: {
            beforeValidate: [
              ({ value, siblingData }) => {
                if (typeof value === 'string' && value.trim()) return slugify(value)
                const label = (siblingData as { label?: unknown })?.label
                if (typeof label === 'string' && label.trim()) return slugify(label)
                return value
              },
            ],
          },
          admin: {
            description: 'Stable identifier, auto-generated from the label. Changing it clears saved values.',
          },
        },
        {
          name: 'label',
          type: 'text',
          localized: true,
          // Deliberately NOT required: it is localized, so requiring it would
          // block translating a taxonomy into another locale unless every
          // term-field label is translated in the same save. Falls back to the
          // key when blank (see resolveTermDetails).
          admin: { description: 'Shown next to the value, e.g. "Country". Falls back to the key if left blank.' },
        },
        {
          name: 'fieldType',
          type: 'select',
          options: [...TERM_FIELD_TYPES],
          defaultValue: 'text',
        },
      ],
    },
  ],
  timestamps: true,
}
