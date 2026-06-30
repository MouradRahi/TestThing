import type { GlobalConfig } from 'payload'
import { safeRevalidatePath } from '../lib/revalidate'
import { mediaUrl } from '../lib/media-fill'
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
    // Picked Media on any block → copy its public URL into the text field the section reads
    beforeValidate: [
      async ({ data, req }) => {
        if (!data || !Array.isArray(data.sections)) return data
        for (const block of data.sections) {
          if (!block) continue
          switch (block.blockType) {
            case 'hero':
            case 'cta-banner':
              if (block.bgImageMedia) {
                const url = await mediaUrl(req.payload, block.bgImageMedia)
                if (url) block.bgImage = url
              }
              break
            case 'image-text':
              if (block.imageMedia) {
                const url = await mediaUrl(req.payload, block.imageMedia)
                if (url) block.image = url
              }
              break
            case 'slideshow':
              if (Array.isArray(block.slides)) {
                for (const slide of block.slides) {
                  if (slide?.bgImageMedia) {
                    const url = await mediaUrl(req.payload, slide.bgImageMedia)
                    if (url) slide.bgImage = url
                  }
                }
              }
              break
          }
        }
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
      ],
      admin: {
        initCollapsed: true,
        description: 'Drag to reorder. Click a section to expand and edit its fields.',
      },
    },
  ],
}
