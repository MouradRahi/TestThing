import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { TrackForm } from './TrackForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('track')
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function TrackOrderPage() {
  const t = await getTranslations('track')
  return (
    <div className="max-w-md mx-auto px-6 py-24">
      <h1 className="text-2xl font-bold text-foreground mb-3">{t('title')}</h1>
      <p className="text-muted text-sm leading-relaxed mb-10">{t('intro')}</p>
      <TrackForm />
    </div>
  )
}
