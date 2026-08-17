import type { CollectionConfig } from 'payload'
import { formatSlug } from '../lib/slug'
import { safeRevalidatePath } from '../lib/revalidate'
import { fillBlocksMedia, mediaUrl } from '../lib/media-fill'
import { isAdmin } from '../lib/access'
import { HeroBlock } from '../globals/blocks/hero'
import { SlideshowBlock } from '../globals/blocks/slideshow'
import { FeaturedProductsBlock } from '../globals/blocks/featured-products'
import { ImageTextBlock } from '../globals/blocks/image-text'
import { StatementBlock } from '../globals/blocks/statement'
import { RichTextBlock } from '../globals/blocks/rich-text-block'
import { CTABannerBlock } from '../globals/blocks/cta-banner'
import { NewsletterBlock } from '../globals/blocks/newsletter'

// Blog/editorial (ROADMAP Part 7) — reuses the exact same block builder as
// Pages/Homepage (same reasoning: one system, not three), plus a simple
// richText fallback for posts that are just an article, no landing-page
// sections needed. Deliberately does NOT reuse the Pages collection itself
// (a post has different fields — excerpt, featured image, published date —
// and different storefront surfaces — an index at /blog, not a bare slug).
export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'status', 'publishedDate'],
  },
  access: {
    read: ({ req }) => !!req.user,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => isAdmin(req.user),
  },
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        if (!data) return data
        if (data.featuredImageMedia) {
          const url = await mediaUrl(req.payload, data.featuredImageMedia)
          if (url) data.featuredImage = url
        }
        await fillBlocksMedia(req.payload, data.sections)
        return data
      },
    ],
    afterChange: [
      ({ doc, previousDoc }) => {
        if (doc?.slug) safeRevalidatePath(`/blog/${doc.slug}`)
        if (previousDoc?.slug && previousDoc.slug !== doc?.slug) safeRevalidatePath(`/blog/${previousDoc.slug}`)
        safeRevalidatePath('/blog')
      },
    ],
    afterDelete: [
      ({ doc }) => {
        if (doc?.slug) safeRevalidatePath(`/blog/${doc.slug}`)
        safeRevalidatePath('/blog')
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      hooks: { beforeValidate: [formatSlug] },
      admin: { description: 'Auto-generated from the title if left empty.' },
    },
    { name: 'excerpt', type: 'textarea', localized: true, admin: { description: 'Shown on /blog and used as the meta description when set.' } },
    {
      name: 'featuredImageMedia',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Pick from the Media library or upload an image. Fills the URL below automatically on save.' },
    },
    { name: 'featuredImage', type: 'text', admin: { description: 'Auto-filled from the image above, or paste a Supabase Storage public URL.' } },
    { name: 'featuredImageAlt', type: 'text', localized: true },
    { name: 'author', type: 'text' },
    {
      name: 'publishedDate',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
      admin: { date: { pickerAppearance: 'dayOnly' }, position: 'sidebar' },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      defaultValue: 'draft',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Draft posts are hidden from /blog and the sitemap.',
      },
    },
    {
      name: 'content',
      type: 'richText',
      localized: true,
      admin: { description: 'Simple article body. Ignored when "Sections" below has visible blocks.' },
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
      ],
      admin: {
        initCollapsed: true,
        description: 'Optional — build this post from full-width sections (same blocks as Pages/Homepage) instead of a plain article body.',
      },
    },
  ],
  timestamps: true,
}
