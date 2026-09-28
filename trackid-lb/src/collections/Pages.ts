import type { CollectionConfig } from 'payload'
import { formatSlug } from '../lib/slug'
import { safeRevalidatePath } from '../lib/revalidate'
import { fillBlocksMedia } from '../lib/media-fill'
import { isAdmin } from '../lib/access'
import { HeroBlock } from '../globals/blocks/hero'
import { SlideshowBlock } from '../globals/blocks/slideshow'
import { FeaturedProductsBlock } from '../globals/blocks/featured-products'
import { ImageTextBlock } from '../globals/blocks/image-text'
import { StatementBlock } from '../globals/blocks/statement'
import { RichTextBlock } from '../globals/blocks/rich-text-block'
import { CTABannerBlock } from '../globals/blocks/cta-banner'
import { NewsletterBlock } from '../globals/blocks/newsletter'
import { ProcessStepsBlock } from '../globals/blocks/process-steps'
import { FounderNoteBlock } from '../globals/blocks/founder-note'

// A page serves at both /p/<slug> and the clean /<slug> — revalidate both.
function revalidatePage(slug?: string) {
  if (!slug) return
  safeRevalidatePath(`/p/${slug}`)
  safeRevalidatePath(`/${slug}`)
}

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'status', 'updatedAt'],
  },
  // Editors manage content day-to-day; only admins can delete (ROADMAP F0 §1.6).
  access: {
    read: ({ req }) => !!req.user,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => isAdmin(req.user),
  },
  hooks: {
    // Picked Media on any section block → copy its public URL into the text field the section reads
    beforeValidate: [
      async ({ data, req }) => {
        if (data) await fillBlocksMedia(req.payload, data.sections)
        return data
      },
    ],
    afterChange: [
      ({ doc, previousDoc }) => {
        revalidatePage(doc?.slug)
        if (previousDoc?.slug && previousDoc.slug !== doc?.slug) {
          revalidatePage(previousDoc.slug)
        }
      },
    ],
    afterDelete: [
      ({ doc }) => revalidatePage(doc?.slug),
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      hooks: { beforeValidate: [formatSlug] },
      admin: {
        description: 'Auto-generated from the title if left empty — e.g. "about", "faq", "artist-fairouz"',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      defaultValue: 'published',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Draft pages are hidden from the storefront and the sitemap. Set to Published to make the page live.',
      },
    },
    {
      name: 'content',
      type: 'richText',
      localized: true,
      admin: {
        description: 'Simple text content. Ignored when "Sections" below has visible blocks — build a full landing page there instead.',
      },
    },
    {
      name: 'sections',
      type: 'blocks',
      blocks: [
        HeroBlock,
        SlideshowBlock,
        FeaturedProductsBlock,
        ImageTextBlock,
        StatementBlock,
        RichTextBlock,
        CTABannerBlock,
        NewsletterBlock,
        ProcessStepsBlock,
        FounderNoteBlock,
      ],
      admin: {
        initCollapsed: true,
        description: 'Build this page from full-width sections (same blocks as the homepage). When any section is visible here, it replaces the simple text content above.',
      },
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'metaTitle', type: 'text' },
        { name: 'metaDescription', type: 'textarea' },
        { name: 'ogImage', type: 'text', admin: { description: 'Supabase Storage URL — copy the public URL from the Supabase Storage dashboard' } },
      ],
    },
  ],
  timestamps: true,
}
