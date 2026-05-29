import { HeroSection } from './HeroSection'
import { SlideshowSection } from './SlideshowSection'
import { FeaturedSection } from './FeaturedSection'
import { ImageTextSection } from './ImageTextSection'
import { StatementSection } from './StatementSection'
import { RichTextSection } from './RichTextSection'
import { CTABannerSection } from './CTABannerSection'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Block = Record<string, any> & { blockType: string; hidden?: boolean }

export function BlockRenderer({ sections }: { sections: Block[] }) {
  const visible = sections.filter(b => !b.hidden)

  if (!visible.length) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-center px-6">
        <div>
          <p className="text-muted text-sm">No sections configured.</p>
          <p className="text-muted/40 text-xs mt-2 uppercase tracking-widest">
            Admin → Site Configuration → Homepage
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {visible.map((block, i) => {
        switch (block.blockType) {
          case 'hero':
            return <HeroSection key={i} {...block} />

          case 'slideshow':
            return (
              <SlideshowSection
                key={i}
                slides={block.slides ?? []}
                height={block.height}
                autoplayInterval={block.autoplayInterval}
              />
            )

          case 'featured-products':
            return (
              <FeaturedSection
                key={i}
                sectionTitle={block.sectionTitle}
                viewAllLabel={block.viewAllLabel}
                viewAllHref={block.viewAllHref}
                source={block.source}
                limit={block.limit}
                products={block.products}
              />
            )

          case 'image-text':
            return <ImageTextSection key={i} {...block} />

          case 'statement':
            return <StatementSection key={i} text={block.text} />

          case 'rich-text':
            return <RichTextSection key={i} content={block.content} />

          case 'cta-banner':
            return <CTABannerSection key={i} {...block} />

          default:
            return null
        }
      })}
    </>
  )
}
