import { getPayload } from '@/lib/payload'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { RichTextRenderer } from '@/components/RichTextRenderer'
import { BlockRenderer } from '@/components/sections/BlockRenderer'

export const revalidate = 300
export const dynamicParams = true

export async function generateStaticParams() {
  const payload = await getPayload()
  const { docs } = await payload.find({
    collection: 'pages',
    where: { status: { equals: 'published' } },
    limit: 200,
    select: { slug: true },
  })
  return docs.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const payload = await getPayload()
  const { docs } = await payload.find({
    collection: 'pages',
    where: { slug: { equals: slug }, status: { equals: 'published' } },
    limit: 1,
    locale: locale as 'en' | 'ar',
  })
  const page = docs[0]
  if (!page) return {}
  const seo = page.seo as { metaTitle?: string; metaDescription?: string } | undefined
  return {
    title: seo?.metaTitle || page.title,
    description: seo?.metaDescription || undefined,
    alternates: { canonical: `/${slug}` },
  }
}

export default async function PageRoute({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const payload = await getPayload()

  const { docs } = await payload.find({
    collection: 'pages',
    where: { slug: { equals: slug }, status: { equals: 'published' } },
    limit: 1,
    depth: 2, // resolves manual product relations inside FeaturedProductsBlock
    locale: locale as 'en' | 'ar',
  })

  const page = docs[0]
  if (!page) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sections = (page.sections ?? []) as any[]
  if (sections.some((b) => b && !b.hidden)) {
    return <BlockRenderer sections={sections} />
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-foreground mb-10 leading-tight">{page.title}</h1>
      {page.content && (
        <RichTextRenderer content={page.content as unknown as Parameters<typeof RichTextRenderer>[0]['content']} />
      )}
    </div>
  )
}
