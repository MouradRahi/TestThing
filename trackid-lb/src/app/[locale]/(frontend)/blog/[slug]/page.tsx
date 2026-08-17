import { getPayload } from '@/lib/payload'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { RichTextRenderer } from '@/components/RichTextRenderer'
import { BlockRenderer } from '@/components/sections/BlockRenderer'
import { Link } from '@/i18n/navigation'
import { localizedAlternates } from '@/lib/seo'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'
import { routing } from '@/i18n/routing'
import { getSiteSettings, resolveStoreName } from '@/lib/site-settings'

export const revalidate = 300
export const dynamicParams = true

export async function generateStaticParams() {
  const payload = await getPayload()
  const { docs } = await payload.find({
    collection: 'posts',
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
    collection: 'posts',
    where: { slug: { equals: slug }, status: { equals: 'published' } },
    limit: 1,
    locale: locale as 'en' | 'ar',
  })
  const post = docs[0]
  if (!post) return {}
  return {
    title: post.title,
    description: post.excerpt || undefined,
    alternates: localizedAlternates(`/blog/${slug}`, locale),
    ...(post.featuredImage ? { openGraph: { images: [post.featuredImage] } } : {}),
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const payload = await getPayload()
  const t = await getTranslations('blog')
  const settings = await getSiteSettings(locale)
  const storeName = resolveStoreName(settings)

  const { docs } = await payload.find({
    collection: 'posts',
    where: { slug: { equals: slug }, status: { equals: 'published' } },
    limit: 1,
    depth: 2,
    locale: locale as 'en' | 'ar',
  })

  const post = docs[0]
  if (!post) notFound()

  const breadcrumbJsonLd = buildBreadcrumbJsonLd(
    [{ name: t('title'), path: '/blog' }, { name: post.title }],
    locale,
    routing.defaultLocale,
  )
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    ...(post.excerpt ? { description: post.excerpt } : {}),
    ...(post.featuredImage ? { image: [post.featuredImage] } : {}),
    ...(post.publishedDate ? { datePublished: post.publishedDate } : {}),
    dateModified: post.updatedAt,
    ...(post.author ? { author: { '@type': 'Person', name: post.author } } : {}),
    publisher: { '@type': 'Organization', name: storeName },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sections = (post.sections ?? []) as any[]
  const hasSections = sections.some((b) => b && !b.hidden)

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />

      {hasSections ? (
        <BlockRenderer sections={sections} />
      ) : (
        <div className="max-w-2xl mx-auto px-6 py-16">
          <nav className="flex gap-2 text-[10px] uppercase tracking-widest text-muted mb-8">
            <Link href="/blog" className="hover:text-foreground transition-colors">{t('title')}</Link>
            <span>/</span>
            <span className="text-foreground">{post.title}</span>
          </nav>

          {post.featuredImage && (
            <div className="relative aspect-[16/9] mb-8 bg-surface">
              <Image
                src={post.featuredImage}
                alt={post.featuredImageAlt || post.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 672px"
              />
            </div>
          )}

          <h1 className="text-3xl font-bold text-foreground mb-3 leading-tight">{post.title}</h1>
          <p className="text-xs text-muted uppercase tracking-widest mb-10">
            {post.author ? `${post.author} · ` : ''}
            {post.publishedDate ? new Date(post.publishedDate).toLocaleDateString(locale === 'ar' ? 'ar' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
          </p>

          {post.content && (
            <RichTextRenderer content={post.content as unknown as Parameters<typeof RichTextRenderer>[0]['content']} />
          )}
        </div>
      )}
    </div>
  )
}
