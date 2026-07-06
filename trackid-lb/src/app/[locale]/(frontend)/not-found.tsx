import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/Button'

export default async function NotFound() {
  const t = await getTranslations('errors')
  return (
    <div className="max-w-2xl mx-auto px-6 py-28 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-muted mb-6">{t('notFoundEyebrow')}</p>
      <h1 className="text-3xl font-bold text-foreground mb-4 leading-tight">{t('notFoundTitle')}</h1>
      <p className="text-muted mb-10">{t('notFoundBody')}</p>
      <Button href="/">{t('backHome')}</Button>
    </div>
  )
}
