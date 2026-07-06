import { getLocale } from 'next-intl/server'
import { getPayload } from '@/lib/payload'
import { getSiteSettings } from '@/lib/site-settings'
import { BlockRenderer } from '@/components/sections/BlockRenderer'

export const revalidate = 60

export default async function HomePage() {
  const locale = await getLocale()
  const payload = await getPayload()
  const [homepage, settings] = await Promise.all([
    payload.findGlobal({
      slug: 'homepage',
      depth: 2, // resolves manual product relations inside FeaturedProductsBlock
      locale: locale as 'en' | 'ar',
    }),
    getSiteSettings(locale),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sections = (homepage.sections ?? []) as any[]

  return <BlockRenderer sections={sections} emptyHeadline={(settings.tagline as string) || undefined} />
}
