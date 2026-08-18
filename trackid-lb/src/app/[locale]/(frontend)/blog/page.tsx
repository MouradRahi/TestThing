import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { getPayload } from '@/lib/payload'
import { localizedAlternates } from '@/lib/seo'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return { alternates: localizedAlternates('/blog', locale) }
}

export default async function BlogIndexPage() {
  const payload = await getPayload()
  const locale = (await getLocale()) as 'en' | 'ar'
  const t = await getTranslations('blog')

  const { docs: posts } = await payload.find({
    collection: 'posts',
    where: { status: { equals: 'published' } },
    sort: '-publishedDate',
    limit: 50,
    locale,
  })

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-foreground mb-10">{t('title')}</h1>

      {posts.length === 0 ? (
        <p className="text-sm text-muted">{t('noPosts')}</p>
      ) : (
        <div className="space-y-10">
          {posts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group flex flex-col sm:flex-row gap-6">
              {post.featuredImage && (
                <div className="relative w-full sm:w-48 aspect-[16/9] shrink-0 bg-surface overflow-hidden">
                  <Image
                    src={post.featuredImage}
                    alt={post.featuredImageAlt || post.title}
                    fill
                    className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    sizes="(max-width: 640px) 100vw, 192px"
                  />
                </div>
              )}
              <div className="flex-1">
                <p className="text-[10px] text-muted uppercase tracking-widest mb-2">
                  {post.publishedDate
                    ? new Date(post.publishedDate).toLocaleDateString(locale === 'ar' ? 'ar' : 'en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : ''}
                </p>
                <h2 className="text-lg font-bold text-foreground group-hover:text-accent transition-colors mb-2">
                  {post.title}
                </h2>
                {post.excerpt && <p className="text-sm text-muted leading-relaxed">{post.excerpt}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
