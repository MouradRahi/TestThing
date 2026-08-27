import type { CollectionConfig } from 'payload'
import { slugify } from '../lib/slug'
import { safeRevalidatePath } from '../lib/revalidate'
import { mediaUrl } from '../lib/media-fill'
import { isAdmin } from '../lib/access'

/** Resolve a taxonomy's URL segment from either a raw id or a populated object. */
async function taxonomySlug(payload: unknown, taxonomy: unknown): Promise<string | null> {
  if (!taxonomy) return null
  if (typeof taxonomy === 'object') {
    const slug = (taxonomy as { slug?: unknown }).slug
    return typeof slug === 'string' ? slug : null
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await (payload as any).findByID({
      collection: 'taxonomies',
      id: taxonomy as string | number,
      depth: 0,
    })
    return typeof doc?.slug === 'string' ? doc.slug : null
  } catch {
    return null
  }
}

/**
 * An entry within an admin-defined taxonomy — "Marie France" under
 * "Manufacturer", "Oak" under "Material". Serves at /<taxonomy>/<term>.
 */
export const TaxonomyTerms: CollectionConfig = {
  slug: 'taxonomy-terms',
  admin: {
    useAsTitle: 'name',
    group: 'Catalog',
    defaultColumns: ['name', 'taxonomy', 'slug', 'updatedAt'],
    description:
      'The individual entries inside each grouping. Create the grouping first under Taxonomies, then add its entries here.',
  },
  access: {
    read: () => true, // public — the storefront renders these
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => isAdmin(req.user),
  },
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        if (data?.imageMedia) {
          const url = await mediaUrl(req.payload, data.imageMedia)
          if (url) data.image = url
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        const slug = await taxonomySlug(req.payload, doc?.taxonomy)
        if (!slug) return
        safeRevalidatePath(`/${slug}`)
        if (doc?.slug) safeRevalidatePath(`/${slug}/${doc.slug}`)
        if (previousDoc?.slug && previousDoc.slug !== doc?.slug) {
          safeRevalidatePath(`/${slug}/${previousDoc.slug}`)
        }
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        const slug = await taxonomySlug(req.payload, doc?.taxonomy)
        if (!slug) return
        safeRevalidatePath(`/${slug}`)
        if (doc?.slug) safeRevalidatePath(`/${slug}/${doc.slug}`)
      },
    ],
  },
  fields: [
    {
      name: 'taxonomy',
      type: 'relationship',
      relationTo: 'taxonomies',
      required: true,
      index: true,
      admin: { description: 'Which grouping this entry belongs to.' },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (typeof value === 'string' && value.trim()) return slugify(value)
            const fallback = data?.name
            if (typeof fallback === 'string' && fallback.trim()) return slugify(fallback)
            return value
          },
        ],
      },
      // Unique PER TAXONOMY, not globally — two brands-worth of groupings may
      // legitimately both want a "classic" entry. Payload's `unique: true` is
      // table-wide, so the check is done here instead.
      validate: async (value: unknown, { req, data, id }: any) => {
        if (typeof value !== 'string' || !value.trim()) return 'A slug is required.'
        const taxonomy = data?.taxonomy
        if (!taxonomy || !req?.payload) return true
        const taxonomyId = typeof taxonomy === 'object' ? taxonomy?.id : taxonomy
        if (!taxonomyId) return true
        try {
          const existing = await req.payload.find({
            collection: 'taxonomy-terms',
            where: { and: [{ taxonomy: { equals: taxonomyId } }, { slug: { equals: value } }] },
            limit: 2,
            depth: 0,
            overrideAccess: true,
          })
          const clash = existing.docs.find((d: { id: unknown }) => String(d.id) !== String(id))
          if (clash) return `Another entry in this grouping already uses "${value}".`
        } catch {
          return true // never block a save because the uniqueness probe failed
        }
        return true
      },
      admin: { description: 'Auto-generated from the name if left empty. Must be unique within its grouping.' },
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'imageMedia',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Pick from the Media library. Fills the URL below automatically on save.' },
    },
    {
      name: 'image',
      type: 'text',
      admin: { description: 'Auto-filled from the image above. You can also paste a Supabase Storage public URL.' },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'taxonomy-terms',
      index: true,
      admin: {
        description:
          'Optional — nest this entry under another (e.g. a sub-brand under its parent brand). Leave empty for a top-level entry.',
      },
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Highlight this entry at the top of its listing page.' },
    },
    {
      name: 'details',
      type: 'array',
      admin: {
        description:
          'Values for the extra fields defined on this entry’s grouping. The key must match a field key set under Taxonomies.',
      },
      fields: [
        {
          name: 'key',
          type: 'text',
          required: true,
          admin: { description: 'Matches a field key from the grouping’s "Term fields".' },
        },
        {
          name: 'value',
          type: 'text',
          localized: true,
        },
      ],
    },
  ],
  timestamps: true,
}
