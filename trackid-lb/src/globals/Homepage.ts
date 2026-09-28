import type { GlobalConfig } from 'payload'
import { safeRevalidatePath } from '../lib/revalidate'
import { fillBlocksMedia } from '../lib/media-fill'
import { HeroBlock } from './blocks/hero'
import { SlideshowBlock } from './blocks/slideshow'
import { FeaturedProductsBlock } from './blocks/featured-products'
import { ImageTextBlock } from './blocks/image-text'
import { StatementBlock } from './blocks/statement'
import { RichTextBlock } from './blocks/rich-text-block'
import { CTABannerBlock } from './blocks/cta-banner'
import { NewsletterBlock } from './blocks/newsletter'
import { ProcessStepsBlock } from './blocks/process-steps'
import { FounderNoteBlock } from './blocks/founder-note'

export const Homepage: GlobalConfig = {
  slug: 'homepage',
  admin: {
    group: 'Site Configuration',
    description: 'Build the homepage by adding, reordering, and toggling sections. No code required.',
  },
  hooks: {
    // Picked Media on any block → copy its public URL into the text field the section reads
    beforeValidate: [
      async ({ data, req }) => {
        if (data) await fillBlocksMedia(req.payload, data.sections)
        return data
      },
    ],
    afterChange: [() => safeRevalidatePath('/')],
  },
  fields: [
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
        description: 'Drag to reorder. Click a section to expand and edit its fields.',
      },
    },
  ],
}
