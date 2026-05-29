import { getPayload } from '@/lib/payload'
import { BlockRenderer } from '@/components/sections/BlockRenderer'

export const revalidate = 60

export default async function HomePage() {
  const payload = await getPayload()
  const homepage = await payload.findGlobal({
    slug: 'homepage',
    depth: 2, // resolves manual product relations inside FeaturedProductsBlock
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sections = (homepage.sections ?? []) as any[]

  return <BlockRenderer sections={sections} />
}
