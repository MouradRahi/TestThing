import { getPayload } from '@/lib/payload'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { RichTextRenderer } from '@/components/RichTextRenderer'

export const revalidate = 300
export const dynamicParams = true

export async function generateStaticParams() {
  const payload = await getPayload()
  const { docs } = await payload.find({
    collection: 'pages',
    limit: 200,
    select: { slug: true },
  })
  return docs.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const payload = await getPayload()
  const { docs } = await payload.find({
    collection: 'pages',
    where: { slug: { equals: slug } },
    limit: 1,
  })
  const page = docs[0]
  if (!page) return {}
  const seo = page.seo as { metaTitle?: string; metaDescription?: string } | undefined
  return {
    title: seo?.metaTitle || page.title,
    description: seo?.metaDescription || undefined,
  }
}

export default async function PageRoute({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const payload = await getPayload()

  const { docs } = await payload.find({
    collection: 'pages',
    where: { slug: { equals: slug } },
    limit: 1,
  })

  const page = docs[0]
  if (!page) notFound()

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-foreground mb-10 leading-tight">{page.title}</h1>
      {page.content && (
        <RichTextRenderer content={page.content as Parameters<typeof RichTextRenderer>[0]['content']} />
      )}
    </div>
  )
}
