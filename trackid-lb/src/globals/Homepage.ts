import type { GlobalConfig } from 'payload'
import { safeRevalidatePath } from '../lib/revalidate'
import { HeroBlock } from './blocks/hero'
import { SlideshowBlock } from './blocks/slideshow'
import { FeaturedProductsBlock } from './blocks/featured-products'
import { ImageTextBlock } from './blocks/image-text'
import { StatementBlock } from './blocks/statement'
import { RichTextBlock } from './blocks/rich-text-block'
import { CTABannerBlock } from './blocks/cta-banner'

export const Homepage: GlobalConfig = {
  slug: 'homepage',
  admin: {
    group: 'Site Configuration',
    description: 'Build the homepage by adding, reordering, and toggling sections. No code required.',
  },
  hooks: {
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
      ],
      admin: {
        initCollapsed: true,
        description: 'Drag to reorder. Click a section to expand and edit its fields.',
      },
    },
  ],
}
